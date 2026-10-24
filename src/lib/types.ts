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
  /** 마지막으로 입장한 시각. 이 칸이 생기기 전에 만든 학생은 비어 있다 */
  lastLoginAt?: string | null;
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

/** 초안 → 배포 중 → 학습 종료(학생은 기록만 볼 수 있고 더 제출할 수 없다) */
export type WorksheetStatus = "draft" | "published" | "ended";

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
  /** 이 의견을 만들 때 쓴 기간 (서울 날짜 YYYY-MM-DD). 교사가 처음부터 직접 쓴 의견은 없다 */
  from?: string;
  to?: string;
  /** 이 의견을 만든 시각. 같은 요청으로 만든 의견은 ClassReport.completedAt과 같다 */
  createdAt?: string;
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
  /** AI에 보내지 않고 미리 정한 의견 (이전 버전에서 기록이 없던 학생) */
  presets: Record<string, StudentComment>;
}

/**
 * 결과 분석표 AI 의견. 반마다 하나이며, 교사가 고른 학생의 의견만 새로 만들어 덮어쓰고 나머지 학생의 의견은 그대로 둔다.
 */
export interface ClassReport {
  classId: string;
  /** 학생 id → 의견 */
  comments: Record<string, StudentComment>;
  /** 마지막으로 의견을 만들 때 쓴 기간 (학생마다 다를 수 있어 의견마다 from·to도 따로 둔다) */
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
  /** 관심 분야 학습에서 퀴즈를 다시 풀기 전까지의 가장 많이 맞힌 개수 (다시 푼 적이 없으면 없음) */
  quizBest?: number | null;
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

/** 관심 분야 학습: 주제 상자를 눌러 언제든 읽는 기사의 분야 */
export type LibraryField = "space" | "earth" | "economy" | "culture";

/**
 * 원문 이용 조건. public-domain: 미국 정부 기관 공공 저작물(NASA·NOAA 등)로 자유롭게 재가공,
 * kogl: 공공누리 출처표시 유형, reference: 저작권이 있는 공공기관 자료로 내용만 참고해 새로 씀(원문 복제 없음)
 */
export type LibraryLicense = "public-domain" | "kogl" | "reference";

export interface LibraryOrigin {
  /** 기관·사이트 이름. 로고는 쓰지 않고 이름과 링크만 보여 준다 */
  site: string;
  title: string;
  url: string;
  license: LibraryLicense;
}

/** 관심 분야 학습 기사. 반 학습지와 달리 배포 없이 학년군이 맞는 모든 학생이 언제든 읽는다 */
export interface LibraryArticle extends Article {
  field: LibraryField;
  /** 상자에 보이는 키워드 (예: "달", "엘니뇨") */
  keyword: string;
  /** 우리나라 교육과정에서 이 내용을 배우는 학년군. 여기에 든 학년군 학생에게만 보인다 */
  gradeLevels: GradeLevel[];
  /** 관련 교육과정 단원 (예: "초3~4 과학 '지구와 달'") */
  curriculum: string;
  origin: LibraryOrigin;
  /** seed: 코드에 넣어 둔 기사, auto: 서버가 매주 자동으로 만든 기사 */
  addedBy: "seed" | "auto";
  createdAt: string;
}

/** 별 상점 상품: 반마다 선생님이 등록하고, 학생이 관심 분야 학습에서 모은 별로 교환한다 */
export interface ShopItem {
  id: string;
  classId: string;
  /** 그림 대신 보여 주는 이모지 */
  emoji: string;
  name: string;
  description: string;
  /** 별 몇 개로 교환하는지 */
  price: number;
  /** 남은 수량. null이면 제한 없음 */
  stock: number | null;
  /** 학생 한 명이 교환할 수 있는 최대 개수. null이면 제한 없음 */
  perStudentLimit: number | null;
  createdAt: string;
}

/** 교환 기록. 상품을 지워도 기록이 남도록 상품 이름·이모지·가격을 함께 적어 둔다 */
export interface ShopPurchase {
  id: string;
  classId: string;
  studentId: string;
  itemId: string;
  itemName: string;
  itemEmoji: string;
  price: number;
  createdAt: string;
}
