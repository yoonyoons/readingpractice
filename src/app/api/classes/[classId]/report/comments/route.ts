import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { isDemoTeacher } from "@/lib/demo-account";
import { HttpError, readJson, route } from "@/lib/http";
import { emptyReport, requestReportComments } from "@/lib/report-ai";
import { requireTeacherClass } from "@/lib/session";
import { nowIso } from "@/lib/utils";

type Ctx = RouteContext<"/api/classes/[classId]/report/comments">;

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "기간을 다시 골라 주세요.");
const RequestBody = z
  .object({
    from: DATE,
    to: DATE,
    studentIds: z.array(z.string().min(1)).min(1, "의견을 만들 학생을 골라 주세요.").max(200),
  })
  .refine((b) => b.from <= b.to, { message: "시작일이 종료일보다 늦어요." });

/** 결과 분석표: 고른 기간의 결과로 고른 학생들의 AI 의견을 요청한다 (Batch API) */
export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const { classId } = await ctx.params;
  const { teacher, classRoom } = await requireTeacherClass(classId);
  const { from, to, studentIds } = await readJson(req, RequestBody);
  const report = await requestReportComments(classRoom, { from, to }, isDemoTeacher(teacher), studentIds);
  return Response.json({ pending: Boolean(report.pending) });
});

const EditBody = z.object({
  studentId: z.string().min(1),
  studentMessage: z.string().trim().max(500, "학생용 문장은 500자까지 쓸 수 있어요."),
  teacherMemo: z.string().trim().max(1000, "교사용 메모는 1000자까지 쓸 수 있어요."),
});

/** 결과 분석표: 학생 한 명의 AI 의견을 교사가 고친다 */
export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const { classId } = await ctx.params;
  await requireTeacherClass(classId);
  const { studentId, studentMessage, teacherMemo } = await readJson(req, EditBody);
  const db = getDb();
  const student = await db.getStudent(studentId);
  if (!student || student.classId !== classId) throw new HttpError(404, "학생을 찾을 수 없어요.");

  const report = (await db.getClassReport(classId)) ?? emptyReport(classId);
  const saved = await db.saveClassReport({
    ...report,
    // 고쳐도 의견을 만든 기간·시각은 남긴다
    comments: { ...report.comments, [studentId]: { ...report.comments[studentId], studentMessage, teacherMemo } },
    updatedAt: nowIso(),
  });
  return Response.json({ comment: saved.comments[studentId] });
});
