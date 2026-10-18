import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getDb } from "./db";
import { ensureDemoClassData } from "./demo-class";
import type { Teacher } from "./types";
import { makeClassCode, newId, nowIso } from "./utils";

/**
 * 베타 테스트용 공용 교사 계정.
 * 가입 없이 기능을 체험할 수 있게 하되, AI 비용이 들지 않도록 이 계정의 학습지는 항상 예시 기사로 만든다.
 * 체험용 반에는 가상 학생 10명과 최근 4주치 결과를 넣어 결과 분석표를 바로 볼 수 있게 한다.
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
  let classRoom = classes.find((c) => c.name === DEMO_CLASS_NAME) ?? classes[0];
  if (!classRoom) {
    let code = makeClassCode();
    for (let i = 0; i < 5 && (await db.getClassByCode(code)); i++) code = makeClassCode();
    classRoom = await db.createClass({
      id: newId(),
      teacherId: teacher.id,
      name: DEMO_CLASS_NAME,
      gradeLevel: "elem56",
      code,
      createdAt: nowIso(),
    });
  }
  // 체험자 여럿이 동시에 들어와 겹치면 실패할 수 있지만, 입장은 막지 않는다 (다음 입장 때 다시 채운다)
  await ensureDemoClassData(classRoom).catch((e) => console.error("체험용 반의 가상 학생·결과를 만들지 못했어요", e));
  return teacher;
}
