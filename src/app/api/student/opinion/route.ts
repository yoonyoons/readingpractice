import { z } from "zod";
import { getDb } from "@/lib/db";
import { GRADES, MAX_OPINION_CHARS } from "@/lib/grades";
import { HttpError, readJson, route } from "@/lib/http";
import { requireStudentArticle } from "@/lib/student-access";
import { checkStudentText } from "@/lib/moderation";
import { buildOpinionBoard, hasOpinionStep, nowIso } from "@/lib/utils";

const Body = z.object({
  worksheetId: z.string().min(1),
  articleId: z.string().min(1),
  stance: z.number().int().min(0, "내 입장을 골라 주세요."),
  text: z.string().max(MAX_OPINION_CHARS, `생각은 ${MAX_OPINION_CHARS}자까지 쓸 수 있어요.`),
});

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const { student, classRoom, worksheet, article, submission } = await requireStudentArticle(
    body.worksheetId,
    body.articleId,
  );

  if (!hasOpinionStep(article)) throw new HttpError(400, "이 기사에는 생각 나누기가 없어요.");
  if (submission.summaries.length === 0) throw new HttpError(400, "요약을 먼저 제출해 주세요.");
  if (body.stance >= article.stances.length) throw new HttpError(400, "내 입장을 골라 주세요.");
  const text = body.text.trim();
  const minChars = GRADES[classRoom.gradeLevel].opinionMinChars;
  if (text.length < minChars) throw new HttpError(400, `까닭을 ${minChars}자 이상 써 주세요.`);
  const blocked = checkStudentText(text);
  if (blocked) throw new HttpError(400, blocked);

  // 다시 제출해 생각을 고칠 수 있다. 교사가 숨긴 상태는 그대로 둔다.
  submission.opinion = { stance: body.stance, text, submittedAt: nowIso(), hidden: submission.opinion?.hidden ?? false };
  submission.updatedAt = submission.opinion.submittedAt;
  const db = getDb();
  await db.upsertSubmission(submission);

  const board = buildOpinionBoard(article, await db.listSubmissionsByWorksheet(worksheet.id), student.id);
  return Response.json({ opinion: submission.opinion, board });
});
