import { z } from "zod";

export const QuizItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["blank", "synonym", "comprehension"]),
  prompt: z.string().trim().min(1, "퀴즈 질문을 모두 입력해 주세요."),
  sentence: z.string(),
  target: z.string(),
  choices: z.array(z.string().trim().min(1, "퀴즈 보기를 모두 입력해 주세요.")).length(4, "퀴즈 보기는 4개여야 해요."),
  answer: z.number().int().min(0).max(3),
  explanation: z.string(),
});

export const ArticleSchema = z.object({
  id: z.string().min(1),
  topic: z.string(),
  topicSummary: z.string(),
  mentionCount: z.number(),
  status: z.enum(["pending", "ready", "failed"]),
  error: z.string().optional(),
  sourceMode: z.enum(["web", "url", "demo", "crawled", "snippets"]),
  facts: z.array(z.string()).optional(),
  sources: z.array(
    z.object({ title: z.string(), url: z.string(), description: z.string(), pubDate: z.string() }),
  ),
  title: z.string().trim(),
  whyItMatters: z.string().trim(),
  paragraphs: z.array(z.string().trim()),
  vocab: z.array(z.object({ word: z.string().trim(), meaning: z.string().trim() })),
  quiz: z.array(QuizItemSchema),
  keyPoints: z.array(z.string().trim()),
  modelSummary: z.string().trim(),
  opinionQuestion: z.string().trim().default(""),
  stances: z
    .array(z.string().trim())
    .default([])
    .transform((stances) => stances.filter(Boolean)),
});
