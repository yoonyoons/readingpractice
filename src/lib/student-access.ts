import { getDb } from "./db";
import { LIBRARY_WORKSHEET_ID } from "./db/repo";
import { HttpError } from "./http";
import { getLibraryArticle } from "./library";
import { requireStudent } from "./session";
import type { Article, ClassRoom, Submission, Worksheet } from "./types";
import { newId, nowIso } from "./utils";

/**
 * 관심 분야 학습 기사는 학습지가 없으므로, 그 기사 하나만 든 배포된 학습지처럼 다룬다.
 * 학생 반의 학년군이 기사의 학년군에 들어 있어야 한다.
 */
async function libraryWorksheet(classRoom: ClassRoom, articleId: string): Promise<{ worksheet: Worksheet; article: Article }> {
  const article = await getLibraryArticle(articleId);
  if (!article || !article.gradeLevels.includes(classRoom.gradeLevel)) {
    throw new HttpError(404, "기사를 찾을 수 없어요.");
  }
  const worksheet: Worksheet = {
    id: LIBRARY_WORKSHEET_ID,
    classId: classRoom.id,
    title: "관심 분야 학습",
    status: "published",
    articles: [article],
    createdAt: article.createdAt,
    publishedAt: article.createdAt,
  };
  return { worksheet, article };
}

/** 학생이 자기 반에 배포된 기사(또는 학년군이 맞는 관심 분야 학습 기사)에 접근하는지 확인하고, 제출 기록(없으면 새 기록)을 함께 돌려준다 */
export async function requireStudentArticle(worksheetId: string, articleId: string) {
  const { student, classRoom } = await requireStudent();
  const db = getDb();
  let worksheet: Worksheet | null;
  let article: Article | undefined;
  if (worksheetId === LIBRARY_WORKSHEET_ID) {
    ({ worksheet, article } = await libraryWorksheet(classRoom, articleId));
  } else {
    worksheet = await db.getWorksheet(worksheetId);
    if (!worksheet || worksheet.classId !== classRoom.id || worksheet.status !== "published") {
      throw new HttpError(404, "학습지를 찾을 수 없어요.");
    }
    article = worksheet.articles.find((a) => a.id === articleId && a.status === "ready");
  }
  if (!article) throw new HttpError(404, "기사를 찾을 수 없어요.");

  const submission: Submission = (await db.getSubmission(worksheetId, articleId, student.id)) ?? {
    id: newId(),
    worksheetId,
    articleId,
    studentId: student.id,
    readAt: null,
    quizAnswers: {},
    quizDoneAt: null,
    summaries: [],
    opinion: null,
    updatedAt: nowIso(),
  };
  submission.opinion ??= null;
  return { student, classRoom, worksheet, article, submission };
}
