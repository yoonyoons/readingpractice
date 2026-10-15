import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { claudeModel } from "./env";
import { HttpError } from "./http";

/** 안전 분류기가 요청을 거절하면 서버에서 권장 모델로 다시 시도한다 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | undefined;

export function ai() {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Anthropic API 오류를 교사·학생이 알아볼 수 있는 안내로 바꾼다. API 오류가 아니면 null.
 * 원문은 서버 로그에 남긴다.
 */
export function toAiError(error: unknown): HttpError | null {
  if (!(error instanceof Anthropic.APIError)) return null;
  console.error("[anthropic]", error.status, error.message);
  if (error instanceof Anthropic.APIConnectionError) {
    return new HttpError(503, "AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  const detail = (error.error as { error?: { message?: string } } | undefined)?.error?.message ?? error.message;
  if (/credit balance/i.test(detail)) {
    return new HttpError(503, "AI 사용 크레딧이 부족해 지금은 AI 기능을 쓸 수 없어요. 서비스 관리자에게 Anthropic 크레딧 충전을 요청해 주세요.");
  }
  switch (error.status) {
    case 401:
      return new HttpError(503, "AI(Anthropic) API 키가 올바르지 않아요. 서비스 관리자에게 키 설정 확인을 요청해 주세요.");
    case 403:
      return new HttpError(503, "AI(Anthropic) API 키에 사용 권한이 없어요. 서비스 관리자에게 계정 설정 확인을 요청해 주세요.");
    case 404:
      return new HttpError(503, "AI 모델 설정(CLAUDE_MODEL)이 올바르지 않아요. 서비스 관리자에게 확인을 요청해 주세요.");
    case 429:
      return new HttpError(503, "AI 사용량이 잠시 몰렸어요. 1~2분 뒤에 다시 시도해 주세요.");
  }
  if ((error.status ?? 0) >= 500) return new HttpError(503, "AI 서버가 잠시 바빠요. 잠시 후 다시 시도해 주세요.");
  return new HttpError(503, "AI가 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

type Effort = "low" | "medium" | "high";

function assertUsable(response: { stop_reason: string | null }) {
  if (response.stop_reason === "refusal") {
    throw new Error("AI가 이 요청을 처리하지 않았어요. 잠시 후 다시 시도하거나 다른 주제로 만들어 주세요.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("AI 응답이 너무 길어 중간에 끊겼어요. 다시 시도해 주세요.");
  }
}

/**
 * 응답에서 최종 답(텍스트)만 꺼낸다.
 * 서버 쪽 대체 모델(fallbacks)이 쓰이면 content가 [처음 모델의 끊긴 답, fallback 블록, 대체 모델의 답] 순서로 온다.
 * 끊긴 답은 JSON이 아니므로 마지막 fallback 블록 뒤의 텍스트만 쓴다.
 */
function finalText(content: { type: string; text?: string }[]) {
  let from = 0;
  content.forEach((block, i) => {
    if (block.type === "fallback") from = i + 1;
  });
  return content
    .slice(from)
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("");
}

/**
 * 스키마에 맞는 JSON을 받는다. 답이 깨져 있으면 한 번 더 요청한다.
 * zodOutputFormat을 쓰면 SDK가 Claude 구조화 출력이 지원하지 않는 제약(minimum/maxLength 등)을
 * 스키마에서 자동으로 빼고, format.parse()가 그 제약까지 포함해 다시 검증해 준다.
 * SDK의 messages.parse()는 끊긴 답까지 모든 텍스트 블록을 읽다가 실패하므로 쓰지 않는다.
 */
export async function generateJson<S extends z.ZodType>(
  schema: S,
  options: { system: string; prompt: string; effort?: Effort; model?: string },
): Promise<z.output<S>> {
  const model = options.model ?? claudeModel();
  // Haiku 계열은 effort 옵션을 지원하지 않는다
  const effort = model.startsWith("claude-haiku") ? {} : { effort: options.effort ?? "high" };
  const format = zodOutputFormat(schema);

  for (let attempt = 1; ; attempt++) {
    const response = await ai()
      .beta.messages.create({
        model,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: options.system,
        messages: [{ role: "user", content: options.prompt }],
        output_config: { ...effort, format },
      })
      .catch((error: unknown) => {
        throw toAiError(error) ?? error;
      });
    assertUsable(response);
    try {
      return format.parse(finalText(response.content)) as z.output<S>;
    } catch (error) {
      // JSON이 아니거나 스키마에 맞지 않는 답
      console.error("[anthropic] 구조화 출력 오류", `시도 ${attempt}`, error instanceof Error ? error.message : error);
      if (attempt >= 2) throw new Error("AI 응답 형식이 올바르지 않아요. 잠시 후 다시 시도해 주세요.");
    }
  }
}
