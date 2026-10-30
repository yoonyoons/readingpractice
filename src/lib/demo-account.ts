import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getDb } from "./db";
import { DEMO_STUDENT_NAMES, ensureDemoClassData } from "./demo-class";
import { GRADE_LIST } from "./grades";
import type { ClassRoom, GradeLevel, ShopItem, StudentRecord, Teacher } from "./types";
import { makeClassCode, newId, nowIso } from "./utils";

/**
 * 베타 테스트용 공용 교사 계정.
 * 가입 없이 기능을 체험할 수 있게 하되, AI 비용이 들지 않도록 이 계정의 학습지는 항상 예시 기사로 만든다.
 * 학년군마다 체험용 반을 하나씩 두고, 가상 학생 10명과 최근 4주치 결과를 넣어 결과 분석표를 바로 볼 수 있게 한다.
 */
export const DEMO_TEACHER_EMAIL = "beta-demo@readingpractice.local";
/** 학년군별 체험용 반 이름 */
export const DEMO_CLASS_NAMES: Record<GradeLevel, string> = {
  elem34: "체험용 반 (초3~4)",
  elem56: "체험용 반 (초5~6)",
  middle: "체험용 반 (중학교)",
};
/** 학년군을 나누기 전에 쓰던 체험용 반 이름 (남아 있으면 지운다) */
const LEGACY_DEMO_CLASS_NAME = "체험용 반";
/** 체험자가 고른 학년군의 반 (우리 반 목록에 '지금 체험 중'으로 표시한다) */
export const DEMO_CLASS_COOKIE = "demo_class";

/** 체험용 반 별 상점의 예시 상품 (사탕·과자·학용품) */
const DEMO_SHOP_ITEMS: Pick<ShopItem, "emoji" | "name" | "description" | "price" | "stock" | "perStudentLimit">[] = [
  { emoji: "🍬", name: "사탕 1개", description: "쉬는 시간에 선생님께 받아 가요", price: 3, stock: 30, perStudentLimit: null },
  { emoji: "🍭", name: "막대 사탕", description: "", price: 5, stock: 20, perStudentLimit: 2 },
  { emoji: "🍫", name: "초콜릿 1개", description: "", price: 6, stock: 15, perStudentLimit: 2 },
  { emoji: "🍪", name: "과자 한 봉지", description: "금요일에 나눠 줘요", price: 8, stock: 10, perStudentLimit: 1 },
  { emoji: "✏️", name: "연필 1자루", description: "", price: 4, stock: null, perStudentLimit: null },
  { emoji: "🧽", name: "지우개", description: "", price: 4, stock: 20, perStudentLimit: null },
  { emoji: "🖍️", name: "형광펜", description: "", price: 6, stock: 10, perStudentLimit: 1 },
  { emoji: "📒", name: "공책 1권", description: "", price: 7, stock: 10, perStudentLimit: 1 },
];

/** 체험용 반에 상품이 하나도 없으면 예시 상품을 넣는다 (체험자가 모두 지워도 다음 입장 때 다시 채운다) */
async function ensureDemoShop(classRoom: ClassRoom) {
  const db = getDb();
  if ((await db.listShopItems(classRoom.id)).length > 0) return;
  const base = Date.now();
  for (const [i, item] of DEMO_SHOP_ITEMS.entries()) {
    await db.saveShopItem({ id: newId(), classId: classRoom.id, ...item, createdAt: new Date(base + i).toISOString() });
  }
}

export function isDemoTeacher(teacher: Pick<Teacher, "email">) {
  return teacher.email === DEMO_TEACHER_EMAIL;
}

/** 체험 계정의 반인지 (학생 체험에서는 AI 채점 대신 예시 채점을 쓴다) */
export async function isDemoClass(classRoom: Pick<ClassRoom, "teacherId">) {
  const teacher = await getDb().getTeacher(classRoom.teacherId);
  return !!teacher && isDemoTeacher(teacher);
}

/** 선생님 체험: 학년군별 체험용 반을 모두 준비하고, 체험 계정과 고른 학년군의 반을 돌려준다 */
export async function enterDemoTeacher(grade: GradeLevel): Promise<{ teacher: Teacher; classRoom: ClassRoom }> {
  const teacher = await ensureDemoAccount();
  const classes = await listDemoClasses(teacher);
  const rooms = await Promise.all(GRADE_LIST.map((g) => ensureDemoClass(teacher, classes, g.level)));
  return { teacher, classRoom: rooms[GRADE_LIST.findIndex((g) => g.level === grade)] };
}

/** 학생 체험: 고른 학년군 체험용 반의 가상 학생 중 한 명을 무작위로 골라 돌려준다 */
export async function pickDemoStudent(grade: GradeLevel): Promise<StudentRecord> {
  const teacher = await ensureDemoAccount();
  const classRoom = await ensureDemoClass(teacher, await listDemoClasses(teacher), grade);
  const fakes = (await getDb().listStudents(classRoom.id)).filter((s) => DEMO_STUDENT_NAMES.includes(s.name));
  if (fakes.length === 0) throw new Error("체험용 반에 가상 학생이 없어요");
  return fakes[Math.floor(Math.random() * fakes.length)];
}

async function ensureDemoAccount(): Promise<Teacher> {
  const db = getDb();
  const teacher = await db.getTeacherByEmail(DEMO_TEACHER_EMAIL);
  if (teacher) return teacher;
  return db.createTeacher({
    id: newId(),
    email: DEMO_TEACHER_EMAIL,
    name: "체험",
    // 비밀번호 로그인은 쓰지 않는다 (아무도 모르는 무작위 값)
    passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
    createdAt: nowIso(),
  });
}

/** 체험 계정의 반 목록. 학년군을 나누기 전의 '체험용 반'이 남아 있으면 지운다 */
async function listDemoClasses(teacher: Teacher): Promise<ClassRoom[]> {
  const db = getDb();
  const classes = await db.listClasses(teacher.id);
  const legacy = classes.filter((c) => c.name === LEGACY_DEMO_CLASS_NAME);
  await Promise.all(legacy.map((c) => db.deleteClass(c.id).catch((e) => console.error("예전 체험용 반을 지우지 못했어요", e))));
  return classes.filter((c) => !legacy.includes(c));
}

/** 학년군의 체험용 반(배포된 예시 학습지·가상 학생·예시 상품 포함)이 없으면 만들고 돌려준다 */
async function ensureDemoClass(teacher: Teacher, classes: ClassRoom[], grade: GradeLevel): Promise<ClassRoom> {
  const db = getDb();
  const name = DEMO_CLASS_NAMES[grade];
  let classRoom = classes.find((c) => c.name === name && c.gradeLevel === grade);
  if (!classRoom) {
    let code = makeClassCode();
    for (let i = 0; i < 5 && (await db.getClassByCode(code)); i++) code = makeClassCode();
    classRoom = await db.createClass({ id: newId(), teacherId: teacher.id, name, gradeLevel: grade, code, createdAt: nowIso() });
  }
  // 체험자 여럿이 동시에 들어와 겹치면 실패할 수 있지만, 입장은 막지 않는다 (다음 입장 때 다시 채운다)
  await ensureDemoClassData(classRoom).catch((e) => console.error("체험용 반의 가상 학생·결과를 만들지 못했어요", e));
  await ensureDemoShop(classRoom).catch((e) => console.error("체험용 반의 예시 상품을 만들지 못했어요", e));
  return classRoom;
}
