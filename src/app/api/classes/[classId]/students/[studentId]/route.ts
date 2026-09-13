import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { requireTeacherClass } from "@/lib/session";

type Ctx = RouteContext<"/api/classes/[classId]/students/[studentId]">;

async function loadStudent(ctx: Ctx) {
  const { classId, studentId } = await ctx.params;
  await requireTeacherClass(classId);
  const student = await getDb().getStudent(studentId);
  if (!student || student.classId !== classId) throw new HttpError(404, "학생을 찾을 수 없어요.");
  return student;
}

const Body = z.object({ action: z.literal("reset-pin") });

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const student = await loadStudent(ctx);
  await readJson(req, Body);
  await getDb().updateStudent(student.id, { pinHash: null, failedAttempts: 0, lockedUntil: null });
  return Response.json({ ok: true });
});

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const student = await loadStudent(ctx);
  await getDb().deleteStudent(student.id);
  return Response.json({ ok: true });
});
