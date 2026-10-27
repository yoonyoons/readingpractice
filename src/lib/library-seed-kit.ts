import type { GradeLevel, KeywordSummary, LibraryArticle, LibraryField, LibraryOrigin, QuizItem, QuizType } from "./types";

/** 관심 분야 학습 처음 기사(library-seed*.ts)를 적는 틀. 학생 기록이 퀴즈 id에 묶이므로 기사·문항 id는 바꾸지 않는다 */

const CREATED_AT = "2026-10-23T00:00:00.000Z";

export type Quiz = [type: QuizType, prompt: string, sentence: string, target: string, choices: string[], answer: number, explanation: string];

export interface Seed {
  id: string;
  /** 넣은 날 (없으면 처음 기사를 넣은 날) */
  createdAt?: string;
  field: LibraryField;
  keyword: string;
  grade: GradeLevel;
  curriculum: string;
  origin: LibraryOrigin;
  title: string;
  whyItMatters: string;
  paragraphs: string[];
  vocab: [string, string][];
  quiz: Quiz[];
  keyPoints: string[];
  modelSummary: string;
  /** 초3~4 키워드 요약 자료: 문단마다 중심 문장과 글 전체 요약, [[낱말]]이 빈칸 (lib/keyword-summary.ts) */
  keywordSummary?: KeywordSummary;
}

/** 문항 id로 정해지는 순서로 보기를 섞는다. 서버를 다시 켜도 보기 순서가 같아야 학생 기록과 맞는다 */
function arrange(id: string, choices: string[], answer: number) {
  let seed = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const random = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 2 ** 32;
  };
  const order = choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { choices: order.map((i) => choices[i]), answer: order.indexOf(answer) };
}

export function build(seed: Seed): LibraryArticle {
  const quiz: QuizItem[] = seed.quiz.map(([type, prompt, sentence, target, choices, answer, explanation], i) => {
    const id = `${seed.id}-q${i + 1}`;
    return { id, type, prompt, sentence, target, ...arrange(id, choices, answer), explanation };
  });
  return {
    id: seed.id,
    topic: seed.keyword,
    topicSummary: seed.whyItMatters,
    mentionCount: 1,
    status: "ready",
    sourceMode: "url",
    sources: [{ title: `${seed.origin.site} — ${seed.origin.title}`, url: seed.origin.url, description: "", pubDate: "" }],
    title: seed.title,
    whyItMatters: seed.whyItMatters,
    paragraphs: seed.paragraphs,
    vocab: seed.vocab.map(([word, meaning]) => ({ word, meaning })),
    quiz,
    keyPoints: seed.keyPoints,
    modelSummary: seed.modelSummary,
    keywordSummary: seed.keywordSummary,
    // 관심 분야 학습은 혼자 읽는 학습이라 생각 나누기를 두지 않는다
    opinionQuestion: "",
    stances: [],
    field: seed.field,
    keyword: seed.keyword,
    gradeLevels: [seed.grade],
    curriculum: seed.curriculum,
    origin: seed.origin,
    addedBy: "seed",
    createdAt: seed.createdAt ?? CREATED_AT,
  };
}

export const BLANK_PROMPT = "빈칸에 들어갈 알맞은 낱말은 무엇인가요?";
export const syn = (target: string) => `'${target}'와(과) 뜻이 가장 비슷한 말은 무엇인가요?`;

