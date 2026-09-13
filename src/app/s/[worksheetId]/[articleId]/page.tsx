import { notFound, redirect } from "next/navigation";
import { LessonFlow } from "@/components/student/LessonFlow";
import { getDb } from "@/lib/db";
import { getStudentSession } from "@/lib/session";
import { requireStudentArticle } from "@/lib/student-access";
import { buildOpinionBoard, isArticleDone, quizResult, toPublicArticle } from "@/lib/utils";

export default async function LessonPage(props: PageProps<"/s/[worksheetId]/[articleId]">) {
  const { worksheetId, articleId } = await props.params;
  if (!(await getStudentSession())) redirect("/join");

  const data = await requireStudentArticle(worksheetId, articleId).catch(() => null);
  if (!data) notFound();
  const { student, worksheet, article, submission, classRoom } = data;

  const worksheetSubs = await getDb().listSubmissionsByWorksheet(worksheet.id);
  const mine = new Map(worksheetSubs.filter((s) => s.studentId === student.id).map((s) => [s.articleId, s]));

  // 다음에 읽을 기사: 아직 학습을 마치지 않은 다른 기사
  const next = worksheet.articles.find(
    (a) => a.status === "ready" && a.id !== article.id && !isArticleDone(a, mine.get(a.id)),
  );

  return (
    <LessonFlow
      worksheetId={worksheet.id}
      article={toPublicArticle(article)}
      gradeLevel={classRoom.gradeLevel}
      nextHref={next ? `/s/${worksheet.id}/${next.id}` : null}
      initial={{
        read: Boolean(submission.readAt),
        answeredIds: article.quiz.filter((q) => submission.quizAnswers[q.id]).map((q) => q.id),
        quizCorrect: quizResult(article, submission).correct,
        summaries: submission.summaries,
        revealed:
          submission.summaries.length > 0
            ? { modelSummary: article.modelSummary, keyPoints: article.keyPoints }
            : null,
        opinion: submission.opinion,
        board: submission.opinion ? buildOpinionBoard(article, worksheetSubs, student.id) : null,
      }}
    />
  );
}
