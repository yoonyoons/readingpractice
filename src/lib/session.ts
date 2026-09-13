import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { HttpError } from "./http";
import type { ClassRoom, StudentRecord, Teacher } from "./types";

const TEACHER_COOKIE = "ra_teacher";
const STUDENT_COOKIE = "ra_student";
const TEACHER_MAX_AGE = 60 * 60 * 24 * 30;
const STUDENT_MAX_AGE = 60 * 60 * 24 * 14;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET 환경변수가 필요해요.");
    }
    return new TextEncoder().encode("dev-only-session-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(value);
}

async function setSession(cookie: string, role: string, subject: string, maxAge: number) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(secret());
  (await cookies()).set(cookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

async function readSession(cookie: string, role: string) {
  const token = (await cookies()).get(cookie)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === role && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

export const setTeacherSession = (teacherId: string) =>
  setSession(TEACHER_COOKIE, "teacher", teacherId, TEACHER_MAX_AGE);

export const setStudentSession = (studentId: string) =>
  setSession(STUDENT_COOKIE, "student", studentId, STUDENT_MAX_AGE);

export async function clearTeacherSession() {
  (await cookies()).delete(TEACHER_COOKIE);
}

export async function clearStudentSession() {
  (await cookies()).delete(STUDENT_COOKIE);
}

export async function getTeacher(): Promise<Teacher | null> {
  const id = await readSession(TEACHER_COOKIE, "teacher");
  return id ? getDb().getTeacher(id) : null;
}

export async function requireTeacher(): Promise<Teacher> {
  const teacher = await getTeacher();
  if (!teacher) throw new HttpError(401, "선생님 로그인이 필요해요.");
  return teacher;
}

export async function requireTeacherClass(classId: string) {
  const teacher = await requireTeacher();
  const classRoom = await getDb().getClass(classId);
  if (!classRoom || classRoom.teacherId !== teacher.id) throw new HttpError(404, "반을 찾을 수 없어요.");
  return { teacher, classRoom };
}

export async function requireTeacherWorksheet(worksheetId: string) {
  const worksheet = await getDb().getWorksheet(worksheetId);
  if (!worksheet) throw new HttpError(404, "학습지를 찾을 수 없어요.");
  const { teacher, classRoom } = await requireTeacherClass(worksheet.classId);
  return { teacher, classRoom, worksheet };
}

export async function getStudentSession(): Promise<{ student: StudentRecord; classRoom: ClassRoom } | null> {
  const id = await readSession(STUDENT_COOKIE, "student");
  if (!id) return null;
  const db = getDb();
  const student = await db.getStudent(id);
  if (!student) return null;
  const classRoom = await db.getClass(student.classId);
  return classRoom ? { student, classRoom } : null;
}

export async function requireStudent() {
  const session = await getStudentSession();
  if (!session) throw new HttpError(401, "다시 입장해 주세요.");
  return session;
}
