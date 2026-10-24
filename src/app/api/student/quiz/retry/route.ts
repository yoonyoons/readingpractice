import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { LIBRARY_WORKSHEET_ID } from "@/lib/library";
import { requireStudentArticle } from "@/lib/student-access";
import { nowIso, quizResult } from "@/lib/utils";

const Body = z.object({ worksheetId: z.literal(LIBRARY_WORKSHEET_ID), articleId: z.string().min(1) });

/**
 * 관심 분야 학습에서만 퀴즈를 처음부터 다시 푼다. 지금까지 가장 많이 맞힌 개수는 quizBest로 남겨
 * 다시 푸는 동안이나 더 못 풀었을 때도 별이 줄지 않게 한다. (반 학습지 퀴즈는 첫 답만 반영)
 */
export const POST = route(async (req) => {
  const { worksheetId, articleId } = await readJson(req, Body);
  const { article, submission } = await requireStudentArticle(worksheetId, articleId);
  const { correct, answered, total } = quizResult(article, submission);
  if (answered < total) throw new HttpError(400, "지금 풀고 있는 퀴즈를 먼저 끝내 주세요.");

  submission.quizBest = Math.max(submission.quizBest ?? 0, correct);
  submission.quizAnswers = {};
  submission.updatedAt = nowIso();
  await getDb().upsertSubmission(submission);
  return Response.json({ quizBest: submission.quizBest });
});
