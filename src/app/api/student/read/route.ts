import { z } from "zod";
import { getDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { requireStudentArticle } from "@/lib/student-access";
import { nowIso } from "@/lib/utils";

const Body = z.object({ worksheetId: z.string().min(1), articleId: z.string().min(1) });

export const POST = route(async (req) => {
  const { worksheetId, articleId } = await readJson(req, Body);
  const { submission } = await requireStudentArticle(worksheetId, articleId);
  if (!submission.readAt) {
    submission.readAt = nowIso();
    submission.updatedAt = submission.readAt;
    await getDb().upsertSubmission(submission);
  }
  return Response.json({ ok: true });
});
