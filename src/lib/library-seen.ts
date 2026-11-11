import type { LibraryArticle } from "./types";

/** 선생님이 기사 전문 화면에서 보았다고 기억하는 쿠키 (값은 그때 가장 최근 자동 기사의 만든 시각) */
export const librarySeenCookie = (classId: string) => `library_seen_${classId}`;

/** 선생님이 아직 보지 못한 이 학년군 자동 기사 수 (seen이 없으면 모든 자동 기사) */
export function unseenLibraryArticles(articles: LibraryArticle[], seen: string | undefined) {
  const since = seen ? Date.parse(seen) : NaN;
  const auto = articles.filter((a) => a.addedBy === "auto");
  return Number.isNaN(since) ? auto.length : auto.filter((a) => Date.parse(a.createdAt) > since).length;
}
