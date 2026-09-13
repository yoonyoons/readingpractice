import type { Article, OpinionBoard, PublicArticle, QuizType, Submission } from "./types";

/** 빈칸 채우기 문제에서 빈칸 자리를 나타내는 표시 */
export const BLANK = "(      )";

export const QUIZ_TYPE_LABEL: Record<QuizType, string> = {
  blank: "빈칸 채우기",
  synonym: "비슷한 말",
  comprehension: "내용 이해",
};

export function newId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeClassCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

const ORDINALS = ["첫째", "둘째", "셋째", "넷째", "다섯째"];

function seoulParts(date: Date) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { month: get("month"), day: get("day") };
}

export function weekTitle(date = new Date()) {
  const { month, day } = seoulParts(date);
  return `${month}월 ${ORDINALS[Math.ceil(day / 7) - 1]} 주 시사 학습지`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso || Number.isNaN(Date.parse(iso))) return iso || "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined) {
  // 웹 검색 출처의 날짜는 "3 days ago"처럼 날짜 형식이 아닐 수 있다
  if (!iso || Number.isNaN(Date.parse(iso))) return iso || "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** AI가 실수로 HTML/마크다운 태그를 섞어 보내는 경우가 있어, 화면에 그대로 노출되지 않도록 지운다 */
export function clean(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .trim();
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function quizResult(article: Pick<Article, "quiz">, submission: Submission | null | undefined) {
  const total = article.quiz.length;
  if (!submission) return { correct: 0, answered: 0, total };
  let correct = 0;
  let answered = 0;
  for (const q of article.quiz) {
    const a = submission.quizAnswers[q.id];
    if (!a) continue;
    answered++;
    if (a.correct) correct++;
  }
  return { correct, answered, total };
}

export function latestSummary(submission: Submission | null | undefined) {
  return submission?.summaries.at(-1) ?? null;
}

/** 예전에 만든 기사에는 생각 나누기 질문이 없을 수 있다 */
export function hasOpinionStep(article: Pick<Article, "opinionQuestion" | "stances">) {
  return Boolean(article.opinionQuestion) && (article.stances?.length ?? 0) >= 2;
}

/** 요약(과 생각 나누기가 있으면 의견)까지 제출해야 기사 학습을 마친 것으로 본다 */
export function isArticleDone(article: Article, submission: Submission | null | undefined) {
  if (!submission || submission.summaries.length === 0) return false;
  return hasOpinionStep(article) ? Boolean(submission.opinion) : true;
}

export function buildOpinionBoard(article: Article, submissions: Submission[], studentId: string): OpinionBoard {
  const counts = article.stances.map(() => 0);
  const items: (OpinionBoard["items"][number] & { submittedAt: string })[] = [];
  for (const s of submissions) {
    const opinion = s.opinion;
    if (s.articleId !== article.id || !opinion) continue;
    const mine = s.studentId === studentId;
    if (opinion.hidden && !mine) continue;
    if (opinion.stance < counts.length) counts[opinion.stance]++;
    items.push({ stance: opinion.stance, text: opinion.text, mine, hidden: opinion.hidden, submittedAt: opinion.submittedAt });
  }
  items.sort((a, b) => Number(b.mine) - Number(a.mine) || b.submittedAt.localeCompare(a.submittedAt));
  return { counts, items: items.map((item) => ({ stance: item.stance, text: item.text, mine: item.mine, hidden: item.hidden })) };
}

export function toPublicArticle(article: Article): PublicArticle {
  return {
    id: article.id,
    topic: article.topic,
    title: article.title,
    whyItMatters: article.whyItMatters,
    paragraphs: article.paragraphs,
    vocab: article.vocab,
    quiz: article.quiz.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      sentence: q.sentence,
      target: q.target,
      choices: q.choices,
    })),
    sources: article.sources,
    opinionQuestion: article.opinionQuestion ?? "",
    stances: article.stances ?? [],
  };
}
