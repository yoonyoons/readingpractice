import { getDb } from "./db";
import { isDemoGeneration } from "./env";
import { buildAllArticles, cloneArticles, emptyArticle, pickTopics, type TopicPick } from "./generation";
import { GRADE_LIST, GRADES } from "./grades";
import { HttpError } from "./http";
import type { Article, ClassRoom, GradeLevel, WeeklySet, Worksheet } from "./types";
import { newId, nowIso, weekKey, weekStartIso, weekTitle } from "./utils";

/*
 * 이번 주 기사
 * 서버(Cron)가 매주 지난 7일 뉴스에서 주제 2개를 한 번 고르고, 학년군마다 그 수준에 맞춘 기사 묶음을 미리 만들어 둔다.
 * 교사는 '이번 주 기사 불러오기'로 자기 반 학년군 묶음을 AI 호출 없이 학습지 초안으로 복사한다.
 */

export function getWeeklySet(grade: GradeLevel, now = new Date()) {
  return getDb().getWeeklySet(weekKey(now), grade);
}

/** 묶음에서 불러올 수 있는(완성된) 기사 */
export function readyArticles(set: WeeklySet | null | undefined): Article[] {
  return set?.articles.filter((a) => a.status === "ready") ?? [];
}

/** 이번 주에 만든 학습지 중 이 묶음을 불러온 것. 같은 주제의 기사가 들어 있으면 불러온 것으로 본다 */
export function findLoadedWorksheet(worksheets: Worksheet[], set: WeeklySet | null, now = new Date()) {
  if (!set) return null;
  const since = Date.parse(weekStartIso(now));
  const topics = new Set(set.articles.map((a) => a.topic));
  return (
    worksheets.find(
      (w) => Date.parse(w.createdAt) >= since && w.articles.some((a) => a.sourceMode !== "url" && topics.has(a.topic)),
    ) ?? null
  );
}

/** 다른 실행(Cron이나 다른 선생님)이 기사를 만드는 중으로 보는 시간. 이보다 오래 멈춰 있으면 끊긴 것으로 보고 이어 만든다 */
const BUILDING_MS = 6 * 60 * 1000;

/**
 * 이번 주 기사를 복사해 이 반의 새 학습지 초안을 만든다.
 * 미리 만든 묶음이 없거나 덜 됐으면(Cron 실패·시간 초과 등) canBuild일 때 이 반 학년군 묶음을 그 자리에서 만든다.
 */
export async function loadWeeklySet(
  classRoom: ClassRoom,
  { canBuild = true, now = new Date() }: { canBuild?: boolean; now?: Date } = {},
): Promise<Worksheet> {
  const grade = classRoom.gradeLevel;
  let set = await getWeeklySet(grade, now);
  // 데모 모드(API 키 없음)는 예시 기사라 비용이 들지 않으므로 누구나 만들 수 있다
  if (readyArticles(set).length === 0 && (canBuild || isDemoGeneration())) {
    if (set && isBuilding(set, now)) {
      throw new HttpError(
        409,
        `이번 주 ${GRADES[grade].label} 기사를 지금 만들고 있어요. 2~3분 뒤에 다시 불러와 주세요.`,
      );
    }
    await buildWeeklySets(now, [grade]);
    set = await getWeeklySet(grade, now);
  }
  if (!set || readyArticles(set).length === 0) {
    if (!canBuild && !isDemoGeneration()) {
      throw new HttpError(404, `이번 주 ${GRADES[grade].label} 기사를 아직 준비하고 있어요. 조금 뒤에 다시 불러와 주세요.`);
    }
    const reasons = [...new Set(set?.articles.map((a) => a.error).filter(Boolean) ?? [])];
    throw new HttpError(
      503,
      `이번 주 ${GRADES[grade].label} 기사를 만들지 못했어요.${reasons.length ? ` (${reasons.join(" / ")})` : ""} 잠시 후 다시 시도해 주세요.`,
    );
  }
  return copyWeeklySet(classRoom, set);
}

/** 아직 만드는 중인 기사가 있고 최근에 저장됐다 */
const isBuilding = (set: WeeklySet, now: Date) =>
  set.articles.some((a) => a.status === "pending") && now.getTime() - Date.parse(set.updatedAt) < BUILDING_MS;

function copyWeeklySet(classRoom: ClassRoom, set: WeeklySet) {
  return getDb().createWorksheet({
    id: newId(),
    classId: classRoom.id,
    title: weekTitle(new Date(`${set.week}T00:00:00+09:00`)),
    status: "draft",
    articles: cloneArticles(readyArticles(set)),
    createdAt: nowIso(),
    publishedAt: null,
  });
}

/** 예시 기사로 만든 묶음은 실제 API 키로 운영하게 되면 새로 만든다 */
const isStale = (set: WeeklySet) => !isDemoGeneration() && set.articles.some((a) => a.sourceMode === "demo");

/** 이미 만든 기사의 주제 재료(요약·사실·출처)를 다른 학년군 기사를 만들 때 그대로 쓴다 */
const topicOf = (article: Article): TopicPick => ({
  name: article.topic,
  summary: article.topicSummary,
  facts: article.facts ?? [],
  mentionCount: article.mentionCount,
  sources: article.sources,
  method: "claude",
});

/**
 * 학년군(기본: 모두)의 이번 주 기사 묶음을 채운다. 여러 번 실행해도 안전하다.
 * - 완성된 학년군은 건너뛰고, 실패하거나 중간에 끊긴 기사만 다시 만든다.
 * - 새로 만드는 학년군은 이번 주 주제를 이미 고른 학년군이 있으면 같은 주제를 쓴다.
 * - 주제를 고르면 먼저 저장하고, 기사도 한 편씩 끝나는 대로 저장해 시간 초과로 끊겨도 다음 실행이 남은 기사부터 이어 간다.
 * 이번 실행에서 만든 묶음을 돌려준다.
 */
export async function buildWeeklySets(
  now = new Date(),
  grades: GradeLevel[] = GRADE_LIST.map((g) => g.level),
): Promise<WeeklySet[]> {
  const db = getDb();
  const week = weekKey(now);
  const existing = new Map((await db.listWeeklySets(week)).map((s) => [s.gradeLevel, s]));
  const usable = (set?: WeeklySet): set is WeeklySet => Boolean(set && set.articles.length > 0 && !isStale(set));

  const targets = grades.filter((grade) => {
    const set = existing.get(grade);
    return !usable(set) || set.articles.some((a) => a.status !== "ready");
  });
  if (targets.length === 0) return [];

  const sets: WeeklySet[] = [];
  let topics: TopicPick[] | undefined;
  for (const grade of targets) {
    const set = existing.get(grade);
    if (usable(set)) {
      sets.push(set);
      continue;
    }
    if (!topics) {
      const donor = [...existing.values()].find(usable);
      topics = donor ? donor.articles.map(topicOf) : await pickTopics(2);
    }
    const time = nowIso();
    sets.push(
      await db.saveWeeklySet({ week, gradeLevel: grade, articles: topics.map(emptyArticle), createdAt: time, updatedAt: time }),
    );
  }

  return Promise.all(sets.map(fillWeeklySet));
}

/** 묶음의 덜 된 기사를 만든다. 한 편이 끝날 때마다 저장해, 중간에 끊겨도 끝난 기사는 남는다 */
async function fillWeeklySet(set: WeeklySet): Promise<WeeklySet> {
  const db = getDb();
  const todo = set.articles.filter((a) => a.status !== "ready");
  if (todo.length === 0) return set;
  // 만들기 시작한 시각을 남겨, 그동안 들어온 불러오기 요청이 같은 기사를 또 만들지 않게 한다
  let current = await db.saveWeeklySet({
    ...set,
    articles: set.articles.map((a) => (a.status === "ready" ? a : { ...a, status: "pending" as const, error: undefined })),
    updatedAt: nowIso(),
  });
  let saving: Promise<unknown> = Promise.resolve();
  await buildAllArticles(todo, set.gradeLevel, (_index, article) => {
    current = { ...current, articles: current.articles.map((a) => (a.id === article.id ? article : a)), updatedAt: nowIso() };
    const snapshot = current;
    // 동시에 끝난 기사끼리 서로 덮어쓰지 않도록 차례로 저장한다
    saving = saving.catch(() => {}).then(() => db.saveWeeklySet(snapshot));
  });
  await saving;
  return current;
}

/** Cron: 이번 주 기사 묶음을 채운다. 이미 모두 준비돼 있으면 AI를 부르지 않고 끝난다 */
export async function runWeeklyJob(now = new Date()) {
  const sets = await buildWeeklySets(now);
  return {
    week: weekKey(now),
    sets: sets.map((s) => ({
      grade: s.gradeLevel,
      ready: readyArticles(s).length,
      failed: s.articles.filter((a) => a.status !== "ready").map((a) => `${a.topic}: ${a.error ?? "만들지 못함"}`),
    })),
    topics: [...new Set(sets.flatMap((s) => s.articles.map((a) => a.topic)))],
  };
}
