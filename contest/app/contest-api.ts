import { HttpError } from "@/lib/http";
import type { Article, GradeLevel, QuizItem, SourceItem, SummaryFeedback } from "@/lib/types";
import { newId, nowIso } from "@/lib/utils";
import { SITE } from "./site";

/*
 * 실제 서비스의 공모전 체험 API(/api/contest/*) 호출.
 * 서버 쪽 코드는 src/app/api/contest, 한도는 src/lib/contest.ts 참고.
 */

export interface Quota {
  left: number;
  limit: number;
  lastDay: string;
}

type QuotaListener = (quota: Quota | null, online: boolean) => void;
const quotaListeners = new Set<QuotaListener>();
let lastQuota: Quota | null = null;
let online = true;

export function onQuota(listener: QuotaListener) {
  quotaListeners.add(listener);
  listener(lastQuota, online);
  return () => {
    quotaListeners.delete(listener);
  };
}

function report(quota: Quota | null | undefined, ok: boolean) {
  if (quota) lastQuota = quota;
  online = ok;
  quotaListeners.forEach((l) => l(lastQuota, online));
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(SITE + path, body === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    report(null, false);
    throw new HttpError(503, "실제 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; quota?: Quota };
  report(data.quota, true);
  if (!res.ok) throw new HttpError(res.status, data.error ?? `서버 오류 (${res.status})`);
  return data as T;
}

/** 실제 서버가 보내는 기사 (정답은 보기 글자) */
interface RemoteArticle {
  topic: string;
  title: string;
  whyItMatters: string;
  paragraphs: string[];
  vocab: Article["vocab"];
  quiz: (Omit<QuizItem, "id" | "answer"> & { answer: string })[];
  keyPoints: string[];
  modelSummary: string;
  opinionQuestion: string;
  stances: string[];
  sources: { title: string; url: string }[];
}

export function toArticle(r: RemoteArticle, sourceMode: Article["sourceMode"], facts?: string[]): Article {
  const sources: SourceItem[] = r.sources.map((s) => ({ ...s, description: "", pubDate: "" }));
  return {
    id: newId(),
    topic: r.topic,
    topicSummary: r.whyItMatters,
    mentionCount: 1,
    status: "ready",
    sourceMode,
    facts: facts ?? r.paragraphs,
    sources,
    title: r.title,
    whyItMatters: r.whyItMatters,
    paragraphs: r.paragraphs,
    vocab: r.vocab,
    quiz: r.quiz.map((q) => ({ ...q, id: newId(), answer: Math.max(0, q.choices.indexOf(q.answer)) })),
    keyPoints: r.keyPoints,
    modelSummary: r.modelSummary,
    opinionQuestion: r.opinionQuestion,
    stances: r.stances,
  };
}

export async function fetchQuota() {
  return call<{ articles: RemoteArticle[]; week: string }>(`/api/contest/weekly?grade=elem56`).catch(() => null);
}

export async function remoteWeekly(grade: GradeLevel): Promise<Article[]> {
  const r = await call<{ articles: RemoteArticle[] }>(`/api/contest/weekly?grade=${grade}`);
  return r.articles.map((a) => toArticle(a, "web"));
}

export async function remoteGrade(
  article: Pick<Article, "title" | "paragraphs" | "keyPoints">,
  grade: GradeLevel,
  text: string,
): Promise<SummaryFeedback> {
  const r = await call<{ feedback: SummaryFeedback }>("/api/contest/summary", {
    grade,
    article: { title: article.title, paragraphs: article.paragraphs.slice(0, 12), keyPoints: article.keyPoints.slice(0, 5) },
    text,
  });
  return r.feedback;
}

export async function remoteBuild(grade: GradeLevel, item: { url: string; text: string }): Promise<Article> {
  const r = await call<{ article: RemoteArticle }>("/api/contest/worksheet", { grade, url: item.url, text: item.text });
  return toArticle(r.article, "url");
}

export interface RemoteStudent {
  byType: Record<"blank" | "synonym" | "comprehension", { answered: number; correct: number }>;
  missedWords: string[];
  summaries: { content: number; ownWords: number; sentence: number }[];
}

export async function remoteComments(grade: GradeLevel, students: RemoteStudent[]) {
  const r = await call<{ comments: { studentMessage: string; teacherMemo: string }[] }>("/api/contest/comments", {
    grade,
    students,
  });
  return r.comments.map((c) => ({ ...c, createdAt: nowIso() }));
}
