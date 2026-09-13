import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { requireStudentArticle } from "@/lib/student-access";
import { nowIso, quizResult } from "@/lib/utils";

const Body = z.object({
  worksheetId: z.string().min(1),
  articleId: z.string().min(1),
  questionId: z.string().min(1),
  choice: z.number().int().min(0).max(3),
});

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const { article, submission } = await requireStudentArticle(body.worksheetId, body.articleId);
  if (!submission.readAt) throw new HttpError(400, "기사를 끝까지 먼저 읽어 주세요.");

  const question = article.quiz.find((q) => q.id === body.questionId);
  if (!question) throw new HttpError(404, "문제를 찾을 수 없어요.");

  // 처음 고른 답만 점수에 반영한다
  const answer = (submission.quizAnswers[question.id] ??= {
    choice: body.choice,
    correct: body.choice === question.answer,
  });
  const done = article.quiz.every((q) => submission.quizAnswers[q.id]);
  if (done && !submission.quizDoneAt) submission.quizDoneAt = nowIso();
  submission.updatedAt = nowIso();
  await getDb().upsertSubmission(submission);

  const { correct, total } = quizResult(article, submission);
  return Response.json({
    choice: answer.choice,
    correct: answer.correct,
    answer: question.answer,
    explanation: question.explanation,
    done,
    score: correct,
    total,
  });
});
