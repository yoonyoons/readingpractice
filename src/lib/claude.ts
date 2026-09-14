import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { claudeModel } from "./env";

/** Claude Opus 5가 안전 분류기로 요청을 거절하면 서버에서 권장 모델로 다시 시도한다 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | undefined;

function ai() {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
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
  const response = await ai().beta.messages.parse({
    model: options.model ?? claudeModel(),
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
    output_config: {
      effort: options.effort ?? "high",
      format: zodOutputFormat(schema),
    },
  });
  assertUsable(response);
  if (response.parsed_output == null) throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해 주세요.");
  return response.parsed_output;
}
