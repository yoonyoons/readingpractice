import { getDb } from "./db";
import { cloneArticles } from "./generation";
import { GRADES } from "./grades";
import { HttpError } from "./http";
import type { Article, ClassRoom, SourceMode, Worksheet } from "./types";
import { newId, nowIso, weekStartIso, weekTitle } from "./utils";

export interface ReusableWorksheet {
  worksheet: Worksheet;
  /** 복사할 완성된 기사 */
  articles: Article[];
}

/**
 * 이번 주(서울 시간 월요일 0시 이후)에 같은 학년군 다른 반에서 뉴스로 만든 학습지를 찾는다.
 * 나만의 학습지(붙여넣은 기사)가 섞인 학습지는 그 반 맞춤이므로 고르지 않는다.
 * demo면 예시 기사 학습지만, 아니면 실제 뉴스 학습지만 고른다.
 */
export async function findReusableWorksheet(
  classRoom: ClassRoom,
  demo: boolean,
  now = new Date(),
): Promise<ReusableWorksheet | null> {
  const mode: SourceMode = demo ? "demo" : "web";
  const worksheets = await getDb().listWorksheetsSince(classRoom.gradeLevel, weekStartIso(now));
  const candidates = worksheets
    .filter((w) => w.classId !== classRoom.id && w.articles.length > 0 && w.articles.every((a) => a.sourceMode === mode))
    .map((worksheet) => ({ worksheet, articles: worksheet.articles.filter((a) => a.status === "ready") }))
    .filter((c) => c.articles.length > 0);

  // 완성된 기사가 많은 것 → 교사가 검토해 배포한 것 → 최신 순 (목록이 이미 최신순이라 정렬이 안정적이면 유지된다)
  candidates.sort(
    (a, b) =>
      b.articles.length - a.articles.length ||
      Number(b.worksheet.status === "published") - Number(a.worksheet.status === "published"),
  );
  return candidates[0] ?? null;
}

/** 찾은 학습지의 기사를 AI 호출 없이 복사해 이 반의 새 초안을 만든다 */
export async function copyReusableWorksheet(classRoom: ClassRoom, demo: boolean): Promise<Worksheet> {
  const found = await findReusableWorksheet(classRoom, demo);
  if (!found) {
    throw new HttpError(
      404,
      `이번 주에 ${GRADES[classRoom.gradeLevel].label} 반에서 만든 학습지가 아직 없어요. '학습지 만들기'로 새로 만들어 주세요.`,
    );
  }
  return getDb().createWorksheet({
    id: newId(),
    classId: classRoom.id,
    title: weekTitle(),
    status: "draft",
    articles: cloneArticles(found.articles),
    createdAt: nowIso(),
    publishedAt: null,
  });
}
