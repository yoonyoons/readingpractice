import { notFound, redirect } from "next/navigation";
import { LessonFlow } from "@/components/student/LessonFlow";
import { getDb } from "@/lib/db";
import { LIBRARY_WORKSHEET_ID, libraryChains, listLibraryFor, starsOf } from "@/lib/library";
import { getStudentSession } from "@/lib/session";
import { requireStudentArticle } from "@/lib/student-access";
import type { LibraryArticle, Submission } from "@/lib/types";
import { buildOpinionBoard, isArticleDone, quizResult, stripGlosses, toPublicArticle } from "@/lib/utils";

export default async function LessonPage(props: PageProps<"/s/[worksheetId]/[articleId]">) {
  const { worksheetId, articleId } = await props.params;
  if (!(await getStudentSession())) redirect("/join");

  const data = await requireStudentArticle(worksheetId, articleId, "view").catch(() => null);
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

  // 다음에 읽을 기사: 아직 학습을 마치지 않은 다른 기사 (관심 분야 학습은 잠금이 풀린 기사 가운데 같은 분야에서 먼저 찾는다)
  let nextHref: string | null = null;
  let unlockNext: { href: string; keyword: string; title: string } | null = null;
  let stars = 0;
  if (library) {
    const field = (article as LibraryArticle).field;
    const articles = await listLibraryFor(classRoom.gradeLevel);
    const { chains, unlocked } = libraryChains(articles, mine);
    const candidates = articles.filter((a) => a.id !== article.id && unlocked.has(a.id) && !isArticleDone(a, mine.get(a.id)));
    const next = candidates.find((a) => a.field === field) ?? candidates[0];
    nextHref = next ? `/s/${LIBRARY_WORKSHEET_ID}/${next.id}` : null;
    // 별 3개를 모으면 열리는 같은 분야의 다음 기사 (제목은 열릴 때 처음 보여 준다)
    const chain = chains[field];
    const after = chain[chain.findIndex((a) => a.id === article.id) + 1];
    if (after) unlockNext = { href: `/s/${LIBRARY_WORKSHEET_ID}/${after.id}`, keyword: after.keyword, title: after.title };
    stars = starsOf(article as LibraryArticle, submission);
  } else if (worksheet.status === "published") {
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
      unlockNext={unlockNext}
      ended={worksheet.status === "ended"}
      initial={{
        read: Boolean(submission.readAt),
        answeredIds: article.quiz.filter((q) => submission.quizAnswers[q.id]).map((q) => q.id),
        quizCorrect: quizResult(article, submission).correct,
        quizBest: submission.quizBest ?? null,
        stars,
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
