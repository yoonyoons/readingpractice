import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { geminiModel } from "./env";

let client: GoogleGenAI | undefined;

function ai() {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return client;
}

/** Gemini가 받지 않는 JSON Schema 키워드를 제거한다 */
function sanitizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeSchema);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$schema" || key === "additionalProperties") continue;
      out[key] = sanitizeSchema(value);
    }
    return out;
  }
  return node;
}

export async function generateJson<S extends z.ZodType>(
  schema: S,
  options: { system: string; prompt: string; temperature?: number },
): Promise<z.output<S>> {
  const responseJsonSchema = sanitizeSchema(z.toJSONSchema(schema));
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai().models.generateContent({
        model: geminiModel(),
        contents: options.prompt,
        config: {
          systemInstruction: options.system,
          temperature: options.temperature ?? 0.4,
          responseMimeType: "application/json",
          responseJsonSchema,
        },
      });
      const text = response.text;
      if (!text) throw new Error("AI 응답이 비어 있어요.");
      return schema.parse(JSON.parse(text));
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`AI 처리에 실패했어요: ${message.slice(0, 200)}`);
}
