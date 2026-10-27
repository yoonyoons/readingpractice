import { z } from "zod";
import { getDb } from "@/lib/db";
import { gradeSummary } from "@/lib/feedback";
import { GRADES, MAX_SUMMARY_ATTEMPTS, MAX_SUMMARY_CHARS } from "@/lib/grades";
import { HttpError, readJson, route } from "@/lib/http";
import { requireStudentArticle } from "@/lib/student-access";
import type { SummaryAttempt } from "@/lib/types";
import { checkStudentText } from "@/lib/moderation";
import { ensureKeywordSummary, gradeKeywordSummary, usesKeywordSummary } from "@/lib/keyword-summary";
import { nowIso, stripGlosses } from "@/lib/utils";

export const maxDuration = 60;

const Body = z.object({
  worksheetId: z.string().min(1),
  articleId: z.string().min(1),
  text: z.string().max(MAX_SUMMARY_CHARS, `요약은 ${MAX_SUMMARY_CHARS}자까지 쓸 수 있어요.`).default(""),
  /** 초3~4 키워드 요약: 빈칸 id → 학생이 쓴 낱말과 시도 횟수 */
  blanks: z
    .record(z.string().max(20), z.object({ value: z.string().max(40), tries: z.number().int().min(1).max(20) }))
    .optional(),
});

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const { classRoom, worksheet, article, submission } = await requireStudentArticle(body.worksheetId, body.articleId);

  if (!article.quiz.every((q) => submission.quizAnswers[q.id])) {
    throw new HttpError(400, "어휘 퀴즈를 먼저 끝내 주세요.");
  }
  if (submission.summaries.length >= MAX_SUMMARY_ATTEMPTS) {
    throw new HttpError(400, `요약은 ${MAX_SUMMARY_ATTEMPTS}번까지 제출할 수 있어요.`);
  }
  let attempt: SummaryAttempt;
  if (usesKeywordSummary(classRoom.gradeLevel)) {
    const ks = await ensureKeywordSummary(worksheet, article, classRoom.gradeLevel);
    const graded = gradeKeywordSummary(ks, body.blanks ?? {});
    if (!graded) throw new HttpError(400, "빈칸을 모두 채워 주세요.");
    attempt = { ...graded, submittedAt: nowIso() };
  } else {
    const text = body.text.trim();
    const minChars = GRADES[classRoom.gradeLevel].summaryMinChars;
    if (text.length < minChars) throw new HttpError(400, `요약을 ${minChars}자 이상 써 주세요.`);
    const blocked = checkStudentText(text);
    if (blocked) throw new HttpError(400, blocked);
    const feedback = await gradeSummary(article, classRoom.gradeLevel, text);
    attempt = { text, feedback, submittedAt: nowIso() };
  }
  submission.summaries.push(attempt);
  submission.quizDoneAt ??= nowIso();
  submission.updatedAt = attempt.submittedAt;
  await getDb().upsertSubmission(submission);

  return Response.json({
    attempt,
    attemptsLeft: MAX_SUMMARY_ATTEMPTS - submission.summaries.length,
    modelSummary: stripGlosses(article.modelSummary),
    keyPoints: article.keyPoints.map(stripGlosses),
  });
});
