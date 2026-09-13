import type {
  ClassRoom,
  StudentRecord,
  Submission,
  Teacher,
  TeacherRecord,
  Worksheet,
} from "../types";

export interface Repo {
  createTeacher(teacher: TeacherRecord): Promise<Teacher>;
  getTeacher(id: string): Promise<Teacher | null>;
  getTeacherByEmail(email: string): Promise<TeacherRecord | null>;

  createClass(classRoom: ClassRoom): Promise<ClassRoom>;
  getClass(id: string): Promise<ClassRoom | null>;
  getClassByCode(code: string): Promise<ClassRoom | null>;
  listClasses(teacherId: string): Promise<ClassRoom[]>;
  deleteClass(id: string): Promise<void>;
  updateClass(id: string, patch: Partial<Pick<ClassRoom, "name" | "autoDraft">>): Promise<ClassRoom>;
  listAutoDraftClasses(): Promise<ClassRoom[]>;

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

  getSubmission(worksheetId: string, articleId: string, studentId: string): Promise<Submission | null>;
  listSubmissionsByWorksheet(worksheetId: string): Promise<Submission[]>;
  listSubmissionsByStudent(studentId: string): Promise<Submission[]>;
  upsertSubmission(submission: Submission): Promise<Submission>;
}
