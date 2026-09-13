import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { claudeModel } from "./env";

/** Claude Opus 5가 안전 분류기로 요청을 거절하면 서버에서 권장 모델로 다시 시도한다 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | undefined;

function ai() {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

type Effort = "low" | "medium" | "high";

function assertUsable(response: Anthropic.Beta.BetaMessage) {
  if (response.stop_reason === "refusal") {
    throw new Error("AI가 이 요청을 처리하지 않았어요. 잠시 후 다시 시도하거나 다른 주제로 만들어 주세요.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("AI 응답이 너무 길어 중간에 끊겼어요. 다시 시도해 주세요.");
  }
}

function jsonSchemaOf(schema: z.ZodType) {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}

/** 한 번 호출해 스키마에 맞는 JSON을 받는다 */
export async function generateJson<S extends z.ZodType>(
  schema: S,
  options: { system: string; prompt: string; effort?: Effort },
): Promise<z.output<S>> {
  const response = await ai().beta.messages.create({
    model: claudeModel(),
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
    output_config: {
      effort: options.effort ?? "high",
      format: { type: "json_schema", schema: jsonSchemaOf(schema) },
    },
  });
  assertUsable(response);

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해 주세요.");
  return parsed.data;
}
