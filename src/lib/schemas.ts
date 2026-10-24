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

/** 별 상점 상품 등록·수정 (수량·1인당 개수는 null이면 제한 없음) */
export const ShopItemInputSchema = z.object({
  emoji: z.string().trim().min(1, "이모지를 골라 주세요.").max(16, "이모지는 하나만 넣어 주세요."),
  name: z.string().trim().min(1, "상품 이름을 입력해 주세요.").max(30, "상품 이름은 30자까지 쓸 수 있어요."),
  description: z.string().trim().max(80, "설명은 80자까지 쓸 수 있어요."),
  price: z.number().int("가격은 정수로 넣어 주세요.").min(1, "가격은 별 1개 이상이어야 해요.").max(999, "가격은 별 999개까지 정할 수 있어요."),
  stock: z.number().int().min(0, "수량은 0개 이상이어야 해요.").max(999, "수량은 999개까지 정할 수 있어요.").nullable(),
  perStudentLimit: z.number().int().min(1, "1인당 개수는 1개 이상이어야 해요.").max(99, "1인당 개수는 99개까지 정할 수 있어요.").nullable(),
});
