import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getDb } from "./db";
import { buildAllArticles, emptyArticle, pickTopics } from "./generation";
import type { Teacher } from "./types";
import { makeClassCode, newId, nowIso } from "./utils";

/**
 * 베타 테스트용 공용 교사 계정.
 * 가입 없이 기능을 체험할 수 있게 하되, AI 비용이 들지 않도록 이 계정의 학습지는 항상 예시 기사로 만든다.
 */
export const DEMO_TEACHER_EMAIL = "beta-demo@readingpractice.local";
export const DEMO_CLASS_NAME = "체험용 반";

export function isDemoTeacher(teacher: Pick<Teacher, "email">) {
  return teacher.email === DEMO_TEACHER_EMAIL;
}

/** 체험 계정과 체험용 반(배포된 예시 학습지 포함)이 없으면 만들고, 계정을 돌려준다 */
export async function ensureDemoTeacher(): Promise<Teacher> {
  const db = getDb();
  let teacher: Teacher | null = await db.getTeacherByEmail(DEMO_TEACHER_EMAIL);
  if (!teacher) {
    teacher = await db.createTeacher({
      id: newId(),
      email: DEMO_TEACHER_EMAIL,
      name: "체험",
      // 비밀번호 로그인은 쓰지 않는다 (아무도 모르는 무작위 값)
      passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
      createdAt: nowIso(),
    });
  }

  const classes = await db.listClasses(teacher.id);
  if (classes.length === 0) {
    let code = makeClassCode();
    for (let i = 0; i < 5 && (await db.getClassByCode(code)); i++) code = makeClassCode();
    const classRoom = await db.createClass({
      id: newId(),
      teacherId: teacher.id,
      name: DEMO_CLASS_NAME,
      gradeLevel: "elem56",
      code,
      autoDraft: false,
      createdAt: nowIso(),
    });
    const topics = await pickTopics(2, true);
    const articles = await buildAllArticles(topics.map(emptyArticle), classRoom.gradeLevel, undefined, true);
    await db.createWorksheet({
      id: newId(),
      classId: classRoom.id,
      title: "체험용 시사 학습지",
      status: "published",
      articles,
      createdAt: nowIso(),
      publishedAt: nowIso(),
    });
  }
  return teacher;
}
