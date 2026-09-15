import { getDb } from "./db";
import { DEMO_TEACHER_EMAIL } from "./demo-account";
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

/** 이번 주 기사를 AI 호출 없이 복사해 이 반의 새 학습지 초안을 만든다 */
export async function loadWeeklySet(classRoom: ClassRoom, now = new Date()): Promise<Worksheet> {
  let set = await getWeeklySet(classRoom.gradeLevel, now);
  // 데모 모드(API 키 없음)는 예시 기사라 비용이 들지 않으므로, 아직 없으면 그 자리에서 만든다
  if (readyArticles(set).length === 0 && isDemoGeneration()) {
    await buildWeeklySets(now);
    set = await getWeeklySet(classRoom.gradeLevel, now);
  }
  if (!set || readyArticles(set).length === 0) {
    throw new HttpError(
      404,
      `이번 주 ${GRADES[classRoom.gradeLevel].label} 기사를 아직 준비하고 있어요. 매주 월요일 아침에 준비되니 조금 뒤에 다시 불러와 주세요.`,
    );
  }
  return copyWeeklySet(classRoom, set);
}

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
 * 모든 학년군의 이번 주 기사 묶음을 채운다. 여러 번 실행해도 안전하다.
 * - 완성된 학년군은 건너뛰고, 실패하거나 중간에 끊긴 기사만 다시 만든다.
 * - 새로 만드는 학년군은 이번 주 주제를 이미 고른 학년군이 있으면 같은 주제를 쓴다.
 * - 주제를 고르면 먼저 저장해 두어, 시간 초과로 끊겨도 다음 실행이 기사 작성부터 이어 간다.
 * 이번 실행에서 만든 묶음을 돌려준다.
 */
export async function buildWeeklySets(now = new Date()): Promise<WeeklySet[]> {
  const db = getDb();
  const week = weekKey(now);
  const existing = new Map((await db.listWeeklySets(week)).map((s) => [s.gradeLevel, s]));
  const usable = (set?: WeeklySet): set is WeeklySet => Boolean(set && set.articles.length > 0 && !isStale(set));

  const targets = GRADE_LIST.map((g) => g.level).filter((grade) => {
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

  return Promise.all(
    sets.map(async (set) => {
      const todo = set.articles.filter((a) => a.status !== "ready");
      const built = new Map((await buildAllArticles(todo, set.gradeLevel)).map((a) => [a.id, a]));
      return db.saveWeeklySet({ ...set, articles: set.articles.map((a) => built.get(a.id) ?? a), updatedAt: nowIso() });
    }),
  );
}

/**
 * Cron: 이번 주 기사 묶음을 채우고, 이번 실행에서 준비된 학년군 중 '주간 초안 자동 준비'를 켠 반에는 초안으로 불러온다.
 * 이미 모두 준비돼 있으면 AI를 부르지 않고 끝난다.
 */
export async function runWeeklyJob(now = new Date()) {
  const db = getDb();
  const sets = await buildWeeklySets(now);
  const ready = new Map(sets.filter((s) => readyArticles(s).length > 0).map((s) => [s.gradeLevel, s]));

  let drafts = 0;
  if (ready.size > 0) {
    const demoTeacher = await db.getTeacherByEmail(DEMO_TEACHER_EMAIL);
    for (const classRoom of await db.listAutoDraftClasses()) {
      const set = ready.get(classRoom.gradeLevel);
      // 여러 사람이 함께 쓰는 베타 체험 계정의 반에는 자동으로 넣지 않는다
      if (!set || classRoom.teacherId === demoTeacher?.id) continue;
      if (findLoadedWorksheet(await db.listWorksheets(classRoom.id), set, now)) continue;
      await copyWeeklySet(classRoom, set);
      drafts++;
    }
  }

  return {
    week: weekKey(now),
    sets: sets.map((s) => ({
      grade: s.gradeLevel,
      ready: readyArticles(s).length,
      failed: s.articles.filter((a) => a.status !== "ready").map((a) => `${a.topic}: ${a.error ?? "만들지 못함"}`),
    })),
    topics: [...new Set(sets.flatMap((s) => s.articles.map((a) => a.topic)))],
    drafts,
  };
}
