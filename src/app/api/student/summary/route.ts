import { z } from "zod";
import { getDb } from "@/lib/db";
import { gradeSummary } from "@/lib/feedback";
import { GRADES, MAX_SUMMARY_ATTEMPTS, MAX_SUMMARY_CHARS } from "@/lib/grades";
import { HttpError, readJson, route } from "@/lib/http";
import { requireStudentArticle } from "@/lib/student-access";
import type { SummaryAttempt } from "@/lib/types";
import { checkStudentText } from "@/lib/moderation";
import { nowIso } from "@/lib/utils";

export const maxDuration = 60;

const Body = z.object({
  worksheetId: z.string().min(1),
  articleId: z.string().min(1),
  text: z.string().max(MAX_SUMMARY_CHARS, `요약은 ${MAX_SUMMARY_CHARS}자까지 쓸 수 있어요.`),
});

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const { classRoom, article, submission } = await requireStudentArticle(body.worksheetId, body.articleId);

  if (!article.quiz.every((q) => submission.quizAnswers[q.id])) {
    throw new HttpError(400, "어휘 퀴즈를 먼저 끝내 주세요.");
  }
  if (submission.summaries.length >= MAX_SUMMARY_ATTEMPTS) {
    throw new HttpError(400, `요약은 ${MAX_SUMMARY_ATTEMPTS}번까지 제출할 수 있어요.`);
  }
  const text = body.text.trim();
  const minChars = GRADES[classRoom.gradeLevel].summaryMinChars;
  if (text.length < minChars) throw new HttpError(400, `요약을 ${minChars}자 이상 써 주세요.`);
  const blocked = checkStudentText(text);
  if (blocked) throw new HttpError(400, blocked);

  const feedback = await gradeSummary(article, classRoom.gradeLevel, text);
  const attempt: SummaryAttempt = { text, feedback, submittedAt: nowIso() };
  submission.summaries.push(attempt);
  submission.quizDoneAt ??= nowIso();
  submission.updatedAt = attempt.submittedAt;
  await getDb().upsertSubmission(submission);

  return Response.json({
    attempt,
    attemptsLeft: MAX_SUMMARY_ATTEMPTS - submission.summaries.length,
    modelSummary: article.modelSummary,
    keyPoints: article.keyPoints,
  });
});
