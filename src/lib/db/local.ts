import { promises as fs } from "fs";
import path from "path";
import type { ClassRoom, StudentRecord, Submission, TeacherRecord, Worksheet } from "../types";
import type { Repo } from "./repo";

/**
 * Supabase 환경변수가 없을 때 쓰는 개발용 저장소.
 * 프로젝트 폴더의 .data/db.json 파일 하나에 모든 데이터를 저장한다.
 */

interface Data {
  teachers: TeacherRecord[];
  classes: ClassRoom[];
  students: StudentRecord[];
  worksheets: Worksheet[];
  submissions: Submission[];
}

const FILE = path.join(process.cwd(), ".data", "db.json");

const globalState = globalThis as unknown as {
  __localDb?: { data: Data | null; queue: Promise<unknown> };
};
const state = (globalState.__localDb ??= { data: null, queue: Promise.resolve() });

async function load(): Promise<Data> {
  if (state.data) return state.data;
  try {
    state.data = JSON.parse(await fs.readFile(FILE, "utf8")) as Data;
  } catch {
    state.data = { teachers: [], classes: [], students: [], worksheets: [], submissions: [] };
  }
  return state.data;
}

async function read<T>(fn: (data: Data) => T): Promise<T> {
  await state.queue;
  return structuredClone(fn(await load()));
}

function write<T>(fn: (data: Data) => T): Promise<T> {
  const run = state.queue.then(async () => {
    const data = await load();
    const result = fn(data);
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(data, null, 1), "utf8");
    return structuredClone(result);
  });
  state.queue = run.catch(() => undefined);
  return run;
}

function stripTeacher({ id, email, name, createdAt }: TeacherRecord) {
  return { id, email, name, createdAt };
}

export function createLocalRepo(): Repo {
  if (process.env.VERCEL) {
    throw new Error("배포 환경에서는 SUPABASE_URL과 SUPABASE_SECRET_KEY 환경변수가 필요해요.");
  }

  return {
    createTeacher: (teacher) =>
      write((d) => {
        d.teachers.push(teacher);
        return stripTeacher(teacher);
      }),
    getTeacher: (id) =>
      read((d) => {
        const t = d.teachers.find((x) => x.id === id);
        return t ? stripTeacher(t) : null;
      }),
    getTeacherByEmail: (email) => read((d) => d.teachers.find((x) => x.email === email) ?? null),

    createClass: (classRoom) =>
      write((d) => {
        d.classes.push(classRoom);
        return classRoom;
      }),
    getClass: (id) => read((d) => d.classes.find((x) => x.id === id) ?? null),
    getClassByCode: (code) => read((d) => d.classes.find((x) => x.code === code) ?? null),
    listClasses: (teacherId) =>
      read((d) =>
        d.classes
          .filter((x) => x.teacherId === teacherId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      ),
    deleteClass: (id) =>
      write((d) => {
        const studentIds = new Set(d.students.filter((s) => s.classId === id).map((s) => s.id));
        const worksheetIds = new Set(d.worksheets.filter((w) => w.classId === id).map((w) => w.id));
        d.classes = d.classes.filter((x) => x.id !== id);
        d.students = d.students.filter((s) => s.classId !== id);
        d.worksheets = d.worksheets.filter((w) => w.classId !== id);
        d.submissions = d.submissions.filter(
          (s) => !studentIds.has(s.studentId) && !worksheetIds.has(s.worksheetId),
        );
      }),

    updateClass: (id, patch) =>
      write((d) => {
        const c = d.classes.find((x) => x.id === id);
        if (!c) throw new Error("반을 찾을 수 없어요.");
        Object.assign(c, patch);
        return c;
      }),
    listAutoDraftClasses: () => read((d) => d.classes.filter((x) => x.autoDraft)),

    createStudent: (student) =>
      write((d) => {
        d.students.push(student);
        return student;
      }),
    getStudent: (id) => read((d) => d.students.find((x) => x.id === id) ?? null),
    getStudentByNumber: (classId, number) =>
      read((d) => d.students.find((x) => x.classId === classId && x.number === number) ?? null),
    listStudents: (classId) =>
      read((d) => d.students.filter((x) => x.classId === classId).sort((a, b) => a.number - b.number)),
    updateStudent: (id, patch) =>
      write((d) => {
        const s = d.students.find((x) => x.id === id);
        if (s) Object.assign(s, patch);
      }),
    deleteStudent: (id) =>
      write((d) => {
        d.students = d.students.filter((x) => x.id !== id);
        d.submissions = d.submissions.filter((x) => x.studentId !== id);
      }),

    createWorksheet: (worksheet) =>
      write((d) => {
        d.worksheets.push(worksheet);
        return worksheet;
      }),
    getWorksheet: (id) => read((d) => d.worksheets.find((x) => x.id === id) ?? null),
    listWorksheets: (classId) =>
      read((d) =>
        d.worksheets
          .filter((x) => x.classId === classId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    updateWorksheet: (id, patch) =>
      write((d) => {
        const w = d.worksheets.find((x) => x.id === id);
        if (!w) throw new Error("학습지를 찾을 수 없어요.");
        Object.assign(w, patch);
        return w;
      }),
    deleteWorksheet: (id) =>
      write((d) => {
        d.worksheets = d.worksheets.filter((x) => x.id !== id);
        d.submissions = d.submissions.filter((x) => x.worksheetId !== id);
      }),

    getSubmission: (worksheetId, articleId, studentId) =>
      read(
        (d) =>
          d.submissions.find(
            (x) => x.worksheetId === worksheetId && x.articleId === articleId && x.studentId === studentId,
          ) ?? null,
      ),
    listSubmissionsByWorksheet: (worksheetId) =>
      read((d) => d.submissions.filter((x) => x.worksheetId === worksheetId)),
    listSubmissionsByStudent: (studentId) => read((d) => d.submissions.filter((x) => x.studentId === studentId)),
    upsertSubmission: (submission) =>
      write((d) => {
        const index = d.submissions.findIndex(
          (x) =>
            x.worksheetId === submission.worksheetId &&
            x.articleId === submission.articleId &&
            x.studentId === submission.studentId,
        );
        if (index >= 0) d.submissions[index] = { ...submission, id: d.submissions[index].id };
        else d.submissions.push(submission);
        return index >= 0 ? d.submissions[index] : submission;
      }),
  };
}
