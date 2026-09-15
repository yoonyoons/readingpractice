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

/** 교사 가입 전 메일로 보낸 인증 코드 (이메일당 하나) */
export interface EmailVerification {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  sentAt: string;
}

export interface ClassRoom {
  id: string;
  teacherId: string;
  name: string;
  gradeLevel: GradeLevel;
  code: string;
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
/** web: 뉴스 검색 기반, url: 교사가 붙여넣은 기사 기반(나만의 학습지), demo: 예시 기사. crawled·snippets는 이전 버전(네이버)으로 만든 기사 */
export type SourceMode = "web" | "url" | "demo" | "crawled" | "snippets";

export interface Article {
  id: string;
  topic: string;
  topicSummary: string;
  mentionCount: number;
  status: ArticleStatus;
  error?: string;
  sourceMode: SourceMode;
  /** 웹 검색으로 확인한 사실. 기사를 다시 만들 때 재료로 쓴다 */
  facts?: string[];
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

/** 이번 주 기사: 서버가 매주 학년군별로 미리 만들어 두는 기사 묶음. 교사가 불러오면 반 학습지 초안으로 복사된다 */
export interface WeeklySet {
  /** 서울 시간 기준 그 주 월요일 (YYYY-MM-DD) */
  week: string;
  gradeLevel: GradeLevel;
  articles: Article[];
  createdAt: string;
  updatedAt: string;
}

/** 결과 분석표 AI 의견 한 명분 */
export interface StudentComment {
  /** 학생 화면에 보이는 격려 문장 */
  studentMessage: string;
  /** 교사만 보는 지도 메모 */
  teacherMemo: string;
}

/** Claude Batch API로 만드는 중인 결과 분석표 AI 의견 요청 */
export interface PendingReportBatch {
  batchId: string;
  /** 의견을 만들 기간 (서울 날짜 YYYY-MM-DD, 양 끝 포함) */
  from: string;
  to: string;
  requestedAt: string;
  /** 마지막으로 Batch 상태를 확인한 시각 */
  checkedAt: string;
  /** Batch 요청(custom_id)마다 key 순서대로 담은 학생 id */
  groups: Record<string, string[]>;
  /** AI에 보내지 않고 미리 정한 의견 (기간 안에 기록이 없는 학생) */
  presets: Record<string, StudentComment>;
}

/** 결과 분석표 AI 의견. 반마다 하나이며, 새로 만든 결과가 도착하면 통째로 바뀐다 */
export interface ClassReport {
  classId: string;
  /** 학생 id → 의견 */
  comments: Record<string, StudentComment>;
  /** 지금 의견을 만들 때 쓴 기간 */
  commentsFrom: string | null;
  commentsTo: string | null;
  completedAt: string | null;
  pending: PendingReportBatch | null;
  /** 마지막 요청에서 생긴 문제 */
  error: string | null;
  updatedAt: string;
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
