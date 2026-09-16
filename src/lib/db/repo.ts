import type {
  ClassReport,
  ClassRoom,
  EmailVerification,
  GradeLevel,
  StudentRecord,
  Submission,
  Teacher,
  TeacherRecord,
  WeeklySet,
  Worksheet,
} from "../types";

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

  getSubmission(worksheetId: string, articleId: string, studentId: string): Promise<Submission | null>;
  listSubmissionsByWorksheet(worksheetId: string): Promise<Submission[]>;
  listSubmissionsByStudent(studentId: string): Promise<Submission[]>;
  upsertSubmission(submission: Submission): Promise<Submission>;
}
