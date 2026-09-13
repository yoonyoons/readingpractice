export type GradeLevel = "elem34" | "elem56" | "middle";

export interface Teacher {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface TeacherRecord extends Teacher {
  passwordHash: string;
}

export interface ClassRoom {
  id: string;
  teacherId: string;
  name: string;
  gradeLevel: GradeLevel;
  code: string;
  /** 매주 월요일 아침에 학습지 초안을 자동으로 만들지 */
  autoDraft: boolean;
  createdAt: string;
}

export interface StudentRecord {
  id: string;
  classId: string;
  number: number;
  name: string;
  pinHash: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
}

export type QuizType = "blank" | "synonym" | "comprehension";

export interface QuizItem {
  id: string;
  type: QuizType;
  prompt: string;
  /** 빈칸 문제는 이미 빈칸 처리된 문장, 비슷한 말 문제는 target이 들어 있는 문장 */
  sentence: string;
  target: string;
  choices: string[];
  answer: number;
  explanation: string;
}

export interface VocabItem {
  word: string;
  meaning: string;
}

export interface SourceItem {
  title: string;
  url: string;
  description: string;
  pubDate: string;
}

export type ArticleStatus = "pending" | "ready" | "failed";
export type SourceMode = "crawled" | "snippets" | "demo";

export interface Article {
  id: string;
  topic: string;
  topicSummary: string;
  mentionCount: number;
  status: ArticleStatus;
  error?: string;
  sourceMode: SourceMode;
  sources: SourceItem[];
  title: string;
  whyItMatters: string;
  paragraphs: string[];
  vocab: VocabItem[];
  quiz: QuizItem[];
  keyPoints: string[];
  modelSummary: string;
  /** 생각 나누기 질문. 비어 있으면 이 단계를 건너뛴다 */
  opinionQuestion: string;
  stances: string[];
}

export type WorksheetStatus = "draft" | "published";

export interface Worksheet {
  id: string;
  classId: string;
  title: string;
  status: WorksheetStatus;
  articles: Article[];
  createdAt: string;
  publishedAt: string | null;
}

export interface SummaryFeedback {
  score: number;
  breakdown: { content: number; ownWords: number; sentence: number };
  strengths: string;
  missing: string;
  advice: string;
  demo?: boolean;
}

export interface SummaryAttempt {
  text: string;
  feedback: SummaryFeedback;
  submittedAt: string;
}

export interface QuizAnswer {
  choice: number;
  correct: boolean;
}

export interface OpinionAnswer {
  stance: number;
  text: string;
  submittedAt: string;
  /** 교사가 친구들에게 보이지 않게 숨긴 의견 */
  hidden: boolean;
}

export interface Submission {
  id: string;
  worksheetId: string;
  articleId: string;
  studentId: string;
  readAt: string | null;
  quizAnswers: Record<string, QuizAnswer>;
  quizDoneAt: string | null;
  summaries: SummaryAttempt[];
  opinion: OpinionAnswer | null;
  updatedAt: string;
}

/** 학생 화면으로 보내는 기사: 퀴즈 정답·해설과 모범 요약은 빠져 있다 */
export interface PublicArticle {
  id: string;
  topic: string;
  title: string;
  whyItMatters: string;
  paragraphs: string[];
  vocab: VocabItem[];
  quiz: Omit<QuizItem, "answer" | "explanation">[];
  sources: SourceItem[];
  opinionQuestion: string;
  stances: string[];
}

/** 학생에게 보여주는 반 친구들의 익명 의견 모음 */
export interface OpinionBoard {
  counts: number[];
  items: { stance: number; text: string; mine: boolean; hidden: boolean }[];
}
