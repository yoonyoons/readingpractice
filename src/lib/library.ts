import { getDb } from "./db";
import { LIBRARY_WORKSHEET_ID } from "./db/repo";
import { LIBRARY_SEED } from "./library-seed";
import { isApprovedOrigin } from "./library-sources";
import { countStars, MAX_STARS } from "./stars";
import type { ClassRoom, GradeLevel, LibraryArticle, LibraryField, LibraryLicense, LibraryOrigin, Submission } from "./types";
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
  reference: "내용을 참고해 AI로 새로 씀",
};

/** 기사 읽기 화면 제목 아래에 보여 줄, 원문을 어떻게 다시 썼는지 알리는 문구 */
export function sourceNoteOf(origin: LibraryOrigin) {
  const how: Record<LibraryLicense, string> = {
    "public-domain": "공공 저작물을 바탕으로 AI가 한국어로 새로 쓴 글이에요.",
    kogl: "공공누리 자료를 바탕으로 AI가 새로 쓴 글이에요.",
    reference: "자료의 내용을 참고해 AI가 새로 쓴 글이에요. 원문의 문장은 옮기지 않았어요.",
  };
  return `🤖 ${origin.site} ${how[origin.license]}`;
}

/** 코드에 넣어 둔 기사와 서버가 자동으로 만든 기사를 모두 모은다 (오래된 것부터). 허용 목록에 없는 출처의 기사는 뺀다 */
export async function listLibraryArticles(): Promise<LibraryArticle[]> {
  const auto = await getDb()
    .listLibraryArticles()
    .catch((e) => {
      // 표를 아직 만들지 않은 DB에서도 처음 기사는 보이도록 한다
      console.error("관심 분야 학습 기사를 불러오지 못했어요", e);
      return [];
    });
  const seen = new Set(LIBRARY_SEED.map((a) => a.id));
  return [...LIBRARY_SEED, ...auto.filter((a) => !seen.has(a.id) && a.status === "ready")].filter((a) =>
    isApprovedOrigin(a.origin.url),
  );
}

/** 이 학년군의 기사 전체 (처음 기사 + 자동 기사). 선생님이 반 목록에 올릴 기사를 고르는 목록이다 */
export async function listLibraryFor(grade: GradeLevel) {
  return (await listLibraryArticles()).filter((a) => a.gradeLevels.includes(grade));
}

/** 반에 올린 기사 id (선생님이 정한 순서). 목록 표(class_library_picks)가 아직 없는 DB면 빈 목록으로 본다 */
export async function libraryPicksOf(classId: string): Promise<string[]> {
  return getDb()
    .listLibraryPicks(classId)
    .catch((e) => {
      console.error("관심 분야 기사 목록을 불러오지 못했어요 (supabase/schema.sql을 실행했는지 확인)", e);
      return [] as string[];
    });
}

/** 이 반 학생이 읽는 기사: 선생님이 고르고 순서를 정해 올린 기사만. 아직 올리지 않았으면 비어 있다 */
export async function listLibraryForClass(classRoom: ClassRoom) {
  const [articles, picks] = await Promise.all([listLibraryFor(classRoom.gradeLevel), libraryPicksOf(classRoom.id)]);
  const byId = new Map(articles.map((a) => [a.id, a]));
  return picks.flatMap((id) => byId.get(id) ?? []);
}

export function starsOf(article: LibraryArticle, submission: Submission | null | undefined) {
  if (!submission?.readAt) return 0;
  const { correct, answered, total } = quizResult(article, submission);
  const done = answered >= total;
  // 퀴즈를 다시 푸는 중이어도 앞서 끝낸 기록(quizBest)이 있으면 그 기록으로 센다
  const best = Math.max(done ? correct : 0, submission.quizBest ?? 0);
  const scores = submission.summaries.map((s) => s.feedback.score);
  return countStars({
    quizDone: done || submission.quizBest != null,
    quizCorrect: best,
    quizTotal: total,
    bestSummary: scores.length ? Math.max(...scores) : null,
  });
}

/**
 * 분야마다 기사가 한 줄로 이어진다. 첫 기사만 열려 있고, 앞 기사에서 별 3개를 모으면 다음 기사가 열린다.
 * 순서는 반 목록(선생님이 정한 순서)이다. 선생님이 순서를 바꿔도 학생이 이미 읽기 시작한 기사는 계속 열려 있다.
 */
export function libraryChains(articles: LibraryArticle[], subMap: Map<string, Submission>) {
  const chains = Object.fromEntries(FIELD_ORDER.map((f) => [f, [] as LibraryArticle[]])) as Record<LibraryField, LibraryArticle[]>;
  for (const article of articles) chains[article.field].push(article);
  const unlocked = new Set<string>();
  for (const field of FIELD_ORDER) {
    let open = true;
    for (const [i, article] of chains[field].entries()) {
      if (i > 0 && starsOf(chains[field][i - 1], subMap.get(chains[field][i - 1].id)) < MAX_STARS) open = false;
      if (open || subMap.get(article.id)?.readAt) unlocked.add(article.id);
    }
  }
  return { chains, unlocked };
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

/** 학생 화면용: 반에서 읽는 기사, 기사별 기록, 분야별·전체 별 */
export async function studentLibrary(classRoom: ClassRoom, studentId: string) {
  // 학습 기록 표(library_submissions)가 아직 없는 DB면 ready가 false다. 이때는 학습을 열지 않는다
  let ready = true;
  const [all, articles, submissions] = await Promise.all([
    listLibraryArticles(),
    listLibraryForClass(classRoom),
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
  for (const article of articles) {
    const f = byField[article.field];
    f.stars += starsOf(article, subMap.get(article.id));
    f.max += MAX_STARS;
    f.count++;
  }
  // 선생님이 목록에서 뺀 기사에서 이미 모은 별도 그대로 센다 (별 상점과 같은 기준)
  const total = totalStars(all, submissions).get(studentId) ?? 0;
  const { chains, unlocked } = libraryChains(articles, subMap);
  return { articles, subMap, byField, total, ready, chains, unlocked };
}
