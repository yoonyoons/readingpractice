import { getDb } from "./db";
import { LIBRARY_WORKSHEET_ID } from "./db/repo";
import { LIBRARY_SEED } from "./library-seed";
import { countStars, MAX_STARS } from "./stars";
import type { GradeLevel, LibraryArticle, LibraryField, LibraryLicense, Submission } from "./types";
import { quizResult } from "./utils";

export { LIBRARY_WORKSHEET_ID };

export const LIBRARY_FIELDS: Record<LibraryField, { label: string; emoji: string; description: string }> = {
  space: { label: "우주·과학", emoji: "🚀", description: "달과 행성, 우주 망원경" },
  earth: { label: "지구·환경", emoji: "🌏", description: "바다와 날씨, 기후" },
  economy: { label: "경제", emoji: "💰", description: "돈과 물가, 금리" },
  culture: { label: "역사·문화", emoji: "🏯", description: "한글과 명절, 우리 문화" },
};

export const FIELD_ORDER: LibraryField[] = ["space", "earth", "economy", "culture"];

export const LICENSE_LABEL: Record<LibraryLicense, string> = {
  "public-domain": "공공 저작물을 한국어로 다시 씀",
  kogl: "공공누리 자료를 다시 씀",
  reference: "내용을 참고해 새로 씀",
};

/** 코드에 넣어 둔 기사와 서버가 자동으로 만든 기사를 모두 모은다 (오래된 것부터) */
export async function listLibraryArticles(): Promise<LibraryArticle[]> {
  const auto = await getDb()
    .listLibraryArticles()
    .catch((e) => {
      // 표를 아직 만들지 않은 DB에서도 처음 기사는 보이도록 한다
      console.error("관심 분야 학습 기사를 불러오지 못했어요", e);
      return [];
    });
  const seen = new Set(LIBRARY_SEED.map((a) => a.id));
  return [...LIBRARY_SEED, ...auto.filter((a) => !seen.has(a.id) && a.status === "ready")];
}

/** 이 학년군 학생이 읽을 수 있는 기사 */
export async function listLibraryFor(grade: GradeLevel) {
  return (await listLibraryArticles()).filter((a) => a.gradeLevels.includes(grade));
}

export async function getLibraryArticle(id: string) {
  return (await listLibraryArticles()).find((a) => a.id === id) ?? null;
}

export function starsOf(article: LibraryArticle, submission: Submission | null | undefined) {
  if (!submission?.readAt) return 0;
  const { correct, answered, total } = quizResult(article, submission);
  const scores = submission.summaries.map((s) => s.feedback.score);
  return countStars({
    quizDone: answered >= total,
    quizCorrect: correct,
    quizTotal: total,
    bestSummary: scores.length ? Math.max(...scores) : null,
  });
}

/** 학생 id → 모은 별 개수. 지금 목록에 있는 기사의 기록만 센다 */
export function totalStars(articles: LibraryArticle[], submissions: Submission[]) {
  const byId = new Map(articles.map((a) => [a.id, a]));
  const totals = new Map<string, number>();
  for (const s of submissions) {
    const article = byId.get(s.articleId);
    if (!article) continue;
    totals.set(s.studentId, (totals.get(s.studentId) ?? 0) + starsOf(article, s));
  }
  return totals;
}

/** 학생 화면용: 학년군 기사, 기사별 기록, 분야별·전체 별 */
export async function studentLibrary(grade: GradeLevel, studentId: string) {
  // 학습 기록 표(library_submissions)가 아직 없는 DB면 ready가 false다. 이때는 학습을 열지 않는다
  let ready = true;
  const [articles, submissions] = await Promise.all([
    listLibraryFor(grade),
    getDb()
      .listLibrarySubmissions([studentId])
      .catch((e) => {
        console.error("관심 분야 학습 기록을 불러오지 못했어요 (supabase/schema.sql을 실행했는지 확인)", e);
        ready = false;
        return [] as Submission[];
      }),
  ]);
  const subMap = new Map(submissions.map((s) => [s.articleId, s]));
  const byField = Object.fromEntries(
    FIELD_ORDER.map((f) => [f, { stars: 0, max: 0, count: 0 }]),
  ) as Record<LibraryField, { stars: number; max: number; count: number }>;
  let total = 0;
  for (const article of articles) {
    const stars = starsOf(article, subMap.get(article.id));
    const f = byField[article.field];
    f.stars += stars;
    f.max += MAX_STARS;
    f.count++;
    total += stars;
  }
  return { articles, subMap, byField, total, ready };
}
