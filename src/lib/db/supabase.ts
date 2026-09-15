import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../env";
import type {
  ClassReport,
  ClassRoom,
  GradeLevel,
  StudentRecord,
  Submission,
  TeacherRecord,
  WeeklySet,
  Worksheet,
  WorksheetStatus,
} from "../types";
import type { Repo } from "./repo";

/* eslint-disable @typescript-eslint/no-explicit-any -- DB 행은 아래 매핑 함수에서 타입을 입힌다 */

const toTeacher = (r: any): TeacherRecord => ({
  id: r.id,
  email: r.email,
  name: r.name,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
});

const toClass = (r: any): ClassRoom => ({
  id: r.id,
  teacherId: r.teacher_id,
  name: r.name,
  gradeLevel: r.grade_level as GradeLevel,
  code: r.code,
  createdAt: r.created_at,
});

const toStudent = (r: any): StudentRecord => ({
  id: r.id,
  classId: r.class_id,
  number: r.number,
  name: r.name,
  pinHash: r.pin_hash,
  failedAttempts: r.failed_attempts,
  lockedUntil: r.locked_until,
  createdAt: r.created_at,
});

const toWorksheet = (r: any): Worksheet => ({
  id: r.id,
  classId: r.class_id,
  title: r.title,
  status: r.status as WorksheetStatus,
  articles: r.articles ?? [],
  createdAt: r.created_at,
  publishedAt: r.published_at,
});

const toWeeklySet = (r: any): WeeklySet => ({
  week: r.week,
  gradeLevel: r.grade_level as GradeLevel,
  articles: r.articles ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toClassReport = (r: any): ClassReport => ({
  classId: r.class_id,
  comments: r.comments ?? {},
  commentsFrom: r.comments_from,
  commentsTo: r.comments_to,
  completedAt: r.completed_at,
  pending: r.pending ?? null,
  error: r.error,
  updatedAt: r.updated_at,
});

const toSubmission = (r: any): Submission => ({
  id: r.id,
  worksheetId: r.worksheet_id,
  articleId: r.article_id,
  studentId: r.student_id,
  readAt: r.read_at,
  quizAnswers: r.quiz_answers ?? {},
  quizDoneAt: r.quiz_done_at,
  summaries: r.summaries ?? [],
  opinion: r.opinion ?? null,
  updatedAt: r.updated_at,
});

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(`DB 오류: ${error.message}`);
  return data;
}

export function createSupabaseRepo(): Repo {
  const { url, key } = supabaseConfig();
  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async createTeacher(t) {
      const row = check(
        await sb
          .from("teachers")
          .insert({ id: t.id, email: t.email, name: t.name, password_hash: t.passwordHash, created_at: t.createdAt })
          .select()
          .single(),
      );
      return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
    },
    async getTeacher(id) {
      const row = check(await sb.from("teachers").select("id,email,name,created_at").eq("id", id).maybeSingle());
      return row ? { id: row.id, email: row.email, name: row.name, createdAt: row.created_at } : null;
    },
    async getTeacherByEmail(email) {
      const row = check(await sb.from("teachers").select().eq("email", email).maybeSingle());
      return row ? toTeacher(row) : null;
    },

    async saveVerification(v) {
      check(
        await sb
          .from("email_verifications")
          .upsert(
            { email: v.email, code_hash: v.codeHash, expires_at: v.expiresAt, attempts: v.attempts, sent_at: v.sentAt },
            { onConflict: "email" },
          ),
      );
    },
    async getVerification(email) {
      const row = check(await sb.from("email_verifications").select().eq("email", email).maybeSingle());
      return row
        ? { email: row.email, codeHash: row.code_hash, expiresAt: row.expires_at, attempts: row.attempts, sentAt: row.sent_at }
        : null;
    },
    async deleteVerification(email) {
      check(await sb.from("email_verifications").delete().eq("email", email));
    },

    async createClass(c) {
      const row = check(
        await sb
          .from("classes")
          .insert({
            id: c.id,
            teacher_id: c.teacherId,
            name: c.name,
            grade_level: c.gradeLevel,
            code: c.code,
            created_at: c.createdAt,
          })
          .select()
          .single(),
      );
      return toClass(row);
    },
    async getClass(id) {
      const row = check(await sb.from("classes").select().eq("id", id).maybeSingle());
      return row ? toClass(row) : null;
    },
    async getClassByCode(code) {
      const row = check(await sb.from("classes").select().eq("code", code).maybeSingle());
      return row ? toClass(row) : null;
    },
    async listClasses(teacherId) {
      const rows = check(await sb.from("classes").select().eq("teacher_id", teacherId).order("created_at"));
      return (rows ?? []).map(toClass);
    },
    async deleteClass(id) {
      check(await sb.from("classes").delete().eq("id", id));
    },

    async createStudent(s) {
      const row = check(
        await sb
          .from("students")
          .insert({
            id: s.id,
            class_id: s.classId,
            number: s.number,
            name: s.name,
            pin_hash: s.pinHash,
            failed_attempts: s.failedAttempts,
            locked_until: s.lockedUntil,
            created_at: s.createdAt,
          })
          .select()
          .single(),
      );
      return toStudent(row);
    },
    async getStudent(id) {
      const row = check(await sb.from("students").select().eq("id", id).maybeSingle());
      return row ? toStudent(row) : null;
    },
    async getStudentByNumber(classId, number) {
      const row = check(
        await sb.from("students").select().eq("class_id", classId).eq("number", number).maybeSingle(),
      );
      return row ? toStudent(row) : null;
    },
    async listStudents(classId) {
      const rows = check(await sb.from("students").select().eq("class_id", classId).order("number"));
      return (rows ?? []).map(toStudent);
    },
    async updateStudent(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.number !== undefined) row.number = patch.number;
      if (patch.pinHash !== undefined) row.pin_hash = patch.pinHash;
      if (patch.failedAttempts !== undefined) row.failed_attempts = patch.failedAttempts;
      if (patch.lockedUntil !== undefined) row.locked_until = patch.lockedUntil;
      check(await sb.from("students").update(row).eq("id", id));
    },
    async deleteStudent(id) {
      check(await sb.from("students").delete().eq("id", id));
    },

    async createWorksheet(w) {
      const row = check(
        await sb
          .from("worksheets")
          .insert({
            id: w.id,
            class_id: w.classId,
            title: w.title,
            status: w.status,
            articles: w.articles,
            created_at: w.createdAt,
            published_at: w.publishedAt,
          })
          .select()
          .single(),
      );
      return toWorksheet(row);
    },
    async getWorksheet(id) {
      const row = check(await sb.from("worksheets").select().eq("id", id).maybeSingle());
      return row ? toWorksheet(row) : null;
    },
    async listWorksheets(classId) {
      const rows = check(
        await sb.from("worksheets").select().eq("class_id", classId).order("created_at", { ascending: false }),
      );
      return (rows ?? []).map(toWorksheet);
    },
    async updateWorksheet(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.articles !== undefined) row.articles = patch.articles;
      if (patch.publishedAt !== undefined) row.published_at = patch.publishedAt;
      const updated = check(await sb.from("worksheets").update(row).eq("id", id).select().single());
      return toWorksheet(updated);
    },
    async deleteWorksheet(id) {
      check(await sb.from("worksheets").delete().eq("id", id));
    },

    async getWeeklySet(week, gradeLevel) {
      const row = check(
        await sb.from("weekly_sets").select().eq("week", week).eq("grade_level", gradeLevel).maybeSingle(),
      );
      return row ? toWeeklySet(row) : null;
    },
    async listWeeklySets(week) {
      const rows = check(await sb.from("weekly_sets").select().eq("week", week));
      return (rows ?? []).map(toWeeklySet);
    },
    async saveWeeklySet(s) {
      const row = check(
        await sb
          .from("weekly_sets")
          .upsert(
            {
              week: s.week,
              grade_level: s.gradeLevel,
              articles: s.articles,
              created_at: s.createdAt,
              updated_at: s.updatedAt,
            },
            { onConflict: "week,grade_level" },
          )
          .select()
          .single(),
      );
      return toWeeklySet(row);
    },

    async getClassReport(classId) {
      const row = check(await sb.from("class_reports").select().eq("class_id", classId).maybeSingle());
      return row ? toClassReport(row) : null;
    },
    async listPendingClassReports() {
      const rows = check(await sb.from("class_reports").select().not("pending", "is", null));
      return (rows ?? []).map(toClassReport);
    },
    async saveClassReport(r) {
      const row = check(
        await sb
          .from("class_reports")
          .upsert(
            {
              class_id: r.classId,
              comments: r.comments,
              comments_from: r.commentsFrom,
              comments_to: r.commentsTo,
              completed_at: r.completedAt,
              pending: r.pending,
              error: r.error,
              updated_at: r.updatedAt,
            },
            { onConflict: "class_id" },
          )
          .select()
          .single(),
      );
      return toClassReport(row);
    },

    async getSubmission(worksheetId, articleId, studentId) {
      const row = check(
        await sb
          .from("submissions")
          .select()
          .eq("worksheet_id", worksheetId)
          .eq("article_id", articleId)
          .eq("student_id", studentId)
          .maybeSingle(),
      );
      return row ? toSubmission(row) : null;
    },
    async listSubmissionsByWorksheet(worksheetId) {
      const rows = check(await sb.from("submissions").select().eq("worksheet_id", worksheetId));
      return (rows ?? []).map(toSubmission);
    },
    async listSubmissionsByStudent(studentId) {
      const rows = check(await sb.from("submissions").select().eq("student_id", studentId));
      return (rows ?? []).map(toSubmission);
    },
    async upsertSubmission(s) {
      const row = check(
        await sb
          .from("submissions")
          .upsert(
            {
              id: s.id,
              worksheet_id: s.worksheetId,
              article_id: s.articleId,
              student_id: s.studentId,
              read_at: s.readAt,
              quiz_answers: s.quizAnswers,
              quiz_done_at: s.quizDoneAt,
              summaries: s.summaries,
              opinion: s.opinion,
              updated_at: s.updatedAt,
            },
            { onConflict: "worksheet_id,article_id,student_id" },
          )
          .select()
          .single(),
      );
      return toSubmission(row);
    },
  };
}
