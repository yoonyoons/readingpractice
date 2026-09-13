import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { requireTeacherWorksheet } from "@/lib/session";
import { nowIso } from "@/lib/utils";

const Body = z.object({
  articleId: z.string().min(1),
  studentId: z.string().min(1),
  hidden: z.boolean(),
});

/** 교사가 학생 의견을 반 친구들에게 숨기거나 다시 보이게 한다 */
export const PATCH = route(async (req: NextRequest, ctx: RouteContext<"/api/worksheets/[worksheetId]/opinions">) => {
  const { worksheetId } = await ctx.params;
  await requireTeacherWorksheet(worksheetId);
  const body = await readJson(req, Body);

  const db = getDb();
  const submission = await db.getSubmission(worksheetId, body.articleId, body.studentId);
  if (!submission?.opinion) throw new HttpError(404, "의견을 찾을 수 없어요.");

  submission.opinion = { ...submission.opinion, hidden: body.hidden };
  submission.updatedAt = nowIso();
  await db.upsertSubmission(submission);
  return Response.json({ ok: true });
});
