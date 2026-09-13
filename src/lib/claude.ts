import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { claudeModel } from "./env";

/** Claude Opus 5가 안전 분류기로 요청을 거절하면 서버에서 권장 모델로 다시 시도한다 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_CONTINUATIONS = 5;

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

/** 도구 없이 한 번 호출해 스키마에 맞는 JSON을 받는다 */
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

export interface WebSource {
  title: string;
  url: string;
  pageAge: string;
  cited: boolean;
}

/** 웹 검색 도구로 조사하게 하고, 조사 글과 출처(인용된 출처 먼저)를 돌려준다 */
export async function researchWithWebSearch(options: {
  system: string;
  prompt: string;
  maxSearches: number;
}): Promise<{ text: string; sources: WebSource[] }> {
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: options.maxSearches,
      user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" },
    },
  ];

  const content: Anthropic.Beta.BetaContentBlock[] = [];
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: options.prompt }];
    // 검색이 길어져 멈추면(pause_turn) 받은 내용을 그대로 돌려보내 이어서 진행한다
    if (content.length > 0) {
      messages.push({ role: "assistant", content: content as unknown as Anthropic.Beta.BetaContentBlockParam[] });
    }
    const response = await ai().beta.messages.create({
      model: claudeModel(),
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: options.system,
      tools,
      messages,
      output_config: { effort: "medium" },
    });
    assertUsable(response);
    content.push(...response.content);
    if (response.stop_reason !== "pause_turn") break;
  }

  const sources = new Map<string, WebSource>();
  const add = (url: string, title: string | null | undefined, pageAge: string | null | undefined, cited: boolean) => {
    const existing = sources.get(url);
    if (existing) {
      existing.cited ||= cited;
      return;
    }
    sources.set(url, { url, title: title || url, pageAge: pageAge ?? "", cited });
  };

  const texts: string[] = [];
  for (const block of content) {
    if (block.type === "text") {
      texts.push(block.text);
      for (const citation of block.citations ?? []) {
        if (citation.type === "web_search_result_location") add(citation.url, citation.title, null, true);
      }
    } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const result of block.content) add(result.url, result.title, result.page_age, false);
    }
  }

  return {
    text: texts.join("").trim(),
    sources: [...sources.values()].sort((a, b) => Number(b.cited) - Number(a.cited)),
  };
}
