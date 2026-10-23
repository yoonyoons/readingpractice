import { notFound, redirect } from "next/navigation";
import { LessonFlow } from "@/components/student/LessonFlow";
import { getDb } from "@/lib/db";
import { LIBRARY_WORKSHEET_ID, listLibraryFor } from "@/lib/library";
import { getStudentSession } from "@/lib/session";
import { requireStudentArticle } from "@/lib/student-access";
import type { LibraryArticle, Submission } from "@/lib/types";
import { buildOpinionBoard, isArticleDone, quizResult, stripGlosses, toPublicArticle } from "@/lib/utils";

export default async function LessonPage(props: PageProps<"/s/[worksheetId]/[articleId]">) {
  const { worksheetId, articleId } = await props.params;
  if (!(await getStudentSession())) redirect("/join");

  const data = await requireStudentArticle(worksheetId, articleId).catch(() => null);
  if (!data) notFound();
  const { student, worksheet, article, submission, classRoom } = data;
  const library = worksheet.id === LIBRARY_WORKSHEET_ID;

  const db = getDb();
  const worksheetSubs = library ? [] : await db.listSubmissionsByWorksheet(worksheet.id);
  const mine = new Map<string, Submission>(
    (library ? await db.listLibrarySubmissions([student.id]) : worksheetSubs.filter((s) => s.studentId === student.id)).map(
      (s) => [s.articleId, s],
    ),
  );

  // 다음에 읽을 기사: 아직 학습을 마치지 않은 다른 기사 (관심 분야 학습은 같은 분야에서 먼저 찾는다)
  let nextHref: string | null = null;
  if (library) {
    const field = (article as LibraryArticle).field;
    const candidates = (await listLibraryFor(classRoom.gradeLevel)).filter(
      (a) => a.id !== article.id && !isArticleDone(a, mine.get(a.id)),
    );
    const next = candidates.find((a) => a.field === field) ?? candidates[0];
    nextHref = next ? `/s/${LIBRARY_WORKSHEET_ID}/${next.id}` : null;
  } else {
    const next = worksheet.articles.find(
      (a) => a.status === "ready" && a.id !== article.id && !isArticleDone(a, mine.get(a.id)),
    );
    nextHref = next ? `/s/${worksheet.id}/${next.id}` : null;
  }

  return (
    <LessonFlow
      worksheetId={worksheet.id}
      article={toPublicArticle(article)}
      gradeLevel={classRoom.gradeLevel}
      nextHref={nextHref}
      homeHref={library ? "/s/explore" : "/s"}
      showStars={library}
      initial={{
        read: Boolean(submission.readAt),
        answeredIds: article.quiz.filter((q) => submission.quizAnswers[q.id]).map((q) => q.id),
        quizCorrect: quizResult(article, submission).correct,
        summaries: submission.summaries,
        revealed:
          submission.summaries.length > 0
            ? { modelSummary: stripGlosses(article.modelSummary), keyPoints: article.keyPoints.map(stripGlosses) }
            : null,
        opinion: submission.opinion,
        board: submission.opinion ? buildOpinionBoard(article, worksheetSubs, student.id) : null,
      }}
    />
  );
}
