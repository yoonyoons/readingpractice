import { getDb } from "./db";
import { DEMO_TEACHER_EMAIL } from "./demo-account";
import { buildAllArticles, cloneArticles, emptyArticle, pickTopics } from "./generation";
import type { Article, GradeLevel } from "./types";
import { newId, nowIso, weekTitle } from "./utils";

/** 같은 주에 두 번 실행되더라도(재시도 등) 학습지를 겹쳐 만들지 않도록 최근 생성 여부를 본다 */
const RECENT_MS = 12 * 60 * 60 * 1000;

/**
 * 자동 준비를 켠 반마다 이번 주 학습지 초안을 만든다.
 * 주제는 한 번만 고르고, 학년군마다 기사를 한 세트씩 만들어 같은 학년군 반에 복사한다.
 */
export async function runWeeklyDrafts(now = new Date()) {
  const db = getDb();
  const demoTeacher = await db.getTeacherByEmail(DEMO_TEACHER_EMAIL);
  // 베타 체험 계정의 반은 실제 뉴스로 만들지 않는다
  const classes = (await db.listAutoDraftClasses()).filter((c) => c.teacherId !== demoTeacher?.id);

  const targets = [];
  for (const classRoom of classes) {
    const latest = (await db.listWorksheets(classRoom.id))[0];
    if (latest && now.getTime() - Date.parse(latest.createdAt) < RECENT_MS) continue;
    targets.push(classRoom);
  }
  if (targets.length === 0) return { classes: 0, worksheets: 0, topics: [] as string[] };

  const topics = await pickTopics(2);
  const grades = [...new Set(targets.map((c) => c.gradeLevel))];
  const setsByGrade = new Map<GradeLevel, Article[]>(
    await Promise.all(
      grades.map(async (grade) => [grade, await buildAllArticles(topics.map(emptyArticle), grade)] as const),
    ),
  );

  for (const classRoom of targets) {
    await db.createWorksheet({
      id: newId(),
      classId: classRoom.id,
      title: weekTitle(now),
      status: "draft",
      articles: cloneArticles(setsByGrade.get(classRoom.gradeLevel)!),
      createdAt: nowIso(),
      publishedAt: null,
    });
  }

  return { classes: targets.length, worksheets: targets.length, topics: topics.map((t) => t.name) };
}
