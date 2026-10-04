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
 * 한 번 호출해 스키마에 맞는 JSON을 받는다.
 * zodOutputFormat + .parse()를 쓰면 SDK가 Claude 구조화 출력이 지원하지 않는 제약(minimum/maxLength 등)을
 * 스키마에서 자동으로 빼고, 응답은 그 제약까지 포함해 클라이언트에서 다시 검증해 준다.
 */
export async function generateJson<S extends z.ZodType>(
  schema: S,
  options: { system: string; prompt: string; effort?: Effort; model?: string },
): Promise<z.output<S>> {
  const model = options.model ?? claudeModel();
  // Haiku 계열은 effort 옵션을 지원하지 않는다
  const effort = model.startsWith("claude-haiku") ? {} : { effort: options.effort ?? "high" };
  const response = await ai()
    .beta.messages.parse({
      model,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: options.system,
      messages: [{ role: "user", content: options.prompt }],
      output_config: {
        ...effort,
        format: zodOutputFormat(schema),
      },
    })
    .catch((error: unknown) => {
      throw toAiError(error) ?? error;
    });
  assertUsable(response);
  if (response.parsed_output == null) throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해 주세요.");
  return response.parsed_output;
}
