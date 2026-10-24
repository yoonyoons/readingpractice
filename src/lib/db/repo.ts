import type {
  ClassReport,
  ClassRoom,
  EmailVerification,
  GradeLevel,
  LibraryArticle,
  ShopItem,
  ShopPurchase,
  StudentRecord,
  Submission,
  Teacher,
  TeacherRecord,
  WeeklySet,
  Worksheet,
} from "../types";

/**
 * 관심 분야 학습 기사의 제출 기록은 학습지가 없으므로 worksheetId 자리에 이 값을 넣는다.
 * getSubmission·upsertSubmission이 이 값을 보고 관심 분야 학습 기록으로 따로 저장한다.
 */
export const LIBRARY_WORKSHEET_ID = "library";

export interface Repo {
  createTeacher(teacher: TeacherRecord): Promise<Teacher>;
  getTeacher(id: string): Promise<Teacher | null>;
  getTeacherByEmail(email: string): Promise<TeacherRecord | null>;
  /** 비밀번호 재설정용 */
  updateTeacherPassword(id: string, passwordHash: string): Promise<void>;

  /** 이메일당 하나만 보관한다 (같은 이메일이면 덮어쓴다) */
  saveVerification(verification: EmailVerification): Promise<void>;
  getVerification(email: string): Promise<EmailVerification | null>;
  deleteVerification(email: string): Promise<void>;

  createClass(classRoom: ClassRoom): Promise<ClassRoom>;
  getClass(id: string): Promise<ClassRoom | null>;
  getClassByCode(code: string): Promise<ClassRoom | null>;
  listClasses(teacherId: string): Promise<ClassRoom[]>;
  deleteClass(id: string): Promise<void>;

  createStudent(student: StudentRecord): Promise<StudentRecord>;
  getStudent(id: string): Promise<StudentRecord | null>;
  getStudentByNumber(classId: string, number: number): Promise<StudentRecord | null>;
  listStudents(classId: string): Promise<StudentRecord[]>;
  updateStudent(id: string, patch: Partial<Omit<StudentRecord, "id" | "classId">>): Promise<void>;
  deleteStudent(id: string): Promise<void>;

  createWorksheet(worksheet: Worksheet): Promise<Worksheet>;
  getWorksheet(id: string): Promise<Worksheet | null>;
  /** 최신순 */
  listWorksheets(classId: string): Promise<Worksheet[]>;
  updateWorksheet(
    id: string,
    patch: Partial<Pick<Worksheet, "title" | "status" | "articles" | "publishedAt">>,
  ): Promise<Worksheet>;
  deleteWorksheet(id: string): Promise<void>;

  /** 이번 주 기사 묶음 (주·학년군마다 하나) */
  getWeeklySet(week: string, gradeLevel: GradeLevel): Promise<WeeklySet | null>;
  listWeeklySets(week: string): Promise<WeeklySet[]>;
  /** 같은 주·학년군 묶음이 있으면 덮어쓴다 */
  saveWeeklySet(set: WeeklySet): Promise<WeeklySet>;

  /** 결과 분석표 AI 의견 (반마다 하나) */
  getClassReport(classId: string): Promise<ClassReport | null>;
  /** Batch API 결과를 기다리는 반들 */
  listPendingClassReports(): Promise<ClassReport[]>;
  saveClassReport(report: ClassReport): Promise<ClassReport>;

  /** 나만의 학습지로 이 반이 그 주(월요일 날짜)에 만든 기사 수. 학습지를 지워도 줄지 않는다 */
  getCustomUsage(classId: string, week: string): Promise<number>;
  addCustomUsage(classId: string, week: string, articleCount: number): Promise<void>;

  /** 서버가 자동으로 만든 관심 분야 학습 기사 (코드에 넣어 둔 기사는 lib/library-seed.ts) */
  listLibraryArticles(): Promise<LibraryArticle[]>;
  saveLibraryArticle(article: LibraryArticle): Promise<void>;
  /** 학생들의 관심 분야 학습 기록 */
  listLibrarySubmissions(studentIds: string[]): Promise<Submission[]>;

  /** 별 상점 상품 (만든 순서) */
  listShopItems(classId: string): Promise<ShopItem[]>;
  getShopItem(id: string): Promise<ShopItem | null>;
  /** 같은 id가 있으면 덮어쓴다 */
  saveShopItem(item: ShopItem): Promise<void>;
  deleteShopItem(id: string): Promise<void>;
  /** 남은 수량이 아직 expected일 때만 하나 줄인다. 그 사이 다른 학생이 가져갔으면 false */
  takeShopStock(id: string, expected: number): Promise<boolean>;
  /** 반의 교환 기록 (최신순) */
  listShopPurchases(classId: string): Promise<ShopPurchase[]>;
  createShopPurchase(purchase: ShopPurchase): Promise<void>;
  /** 별이 모자라는 등 교환을 되돌릴 때만 쓴다 */
  deleteShopPurchase(id: string): Promise<void>;

  /** worksheetId가 LIBRARY_WORKSHEET_ID면 관심 분야 학습 기록이다 */
  getSubmission(worksheetId: string, articleId: string, studentId: string): Promise<Submission | null>;
  listSubmissionsByWorksheet(worksheetId: string): Promise<Submission[]>;
  /** 반 학습지 기록만 (관심 분야 학습 기록은 listLibrarySubmissions) */
  listSubmissionsByStudent(studentId: string): Promise<Submission[]>;
  upsertSubmission(submission: Submission): Promise<Submission>;
}
