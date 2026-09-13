import { getDb } from "./db";
import { HttpError } from "./http";
import { requireStudent } from "./session";
import type { Submission } from "./types";
import { newId, nowIso } from "./utils";

/** 학생이 자기 반에 배포된 기사에 접근하는지 확인하고, 제출 기록(없으면 새 기록)을 함께 돌려준다 */
export async function requireStudentArticle(worksheetId: string, articleId: string) {
  const { student, classRoom } = await requireStudent();
  const db = getDb();
  const worksheet = await db.getWorksheet(worksheetId);
  if (!worksheet || worksheet.classId !== classRoom.id || worksheet.status !== "published") {
    throw new HttpError(404, "학습지를 찾을 수 없어요.");
  }
  const article = worksheet.articles.find((a) => a.id === articleId && a.status === "ready");
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
    updatedAt: nowIso(),
  };
  return { student, classRoom, worksheet, article, submission };
}
