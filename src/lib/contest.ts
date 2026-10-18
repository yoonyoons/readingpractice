import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getDb } from "./db";
import { HttpError } from "./http";
import type { Article, Teacher } from "./types";
import { makeClassCode, newId, nowIso, seoulDate, stripGlosses } from "./utils";

/*
 * 공모전 체험판 API
 * 공모전에 낸 HTML 파일(서버 없이 열리는 체험판)이 로그인 없이 진짜 AI 기능을 쓸 수 있게 연 공개 API다.
 * 누구나 부를 수 있으므로 AI를 부르는 요청은 모두 합쳐 하루 한도를 두고, 심사가 끝나는 날이 지나면 막는다.
 * CORS 헤더는 next.config.ts에서 /api/contest/* 전체에 붙인다.
 */

/** AI를 부르는 체험 요청 하루 한도 (서울 날짜 기준, 모든 기능 합계) */
export const CONTEST_DAILY_LIMIT = 30;
/** 이 날(서울 날짜)까지 쓸 수 있다 */
export const CONTEST_LAST_DAY = "2026-10-28";

/*
 * 한도는 DB 구조를 바꾸지 않으려고 나만의 학습지 사용량 표(custom_usage)에 센다.
 * 로그인할 수 없는 전용 계정의 반 하나를 열쇠로 쓰고, week 칸에 그날 서울 날짜를 넣는다.
 */
const QUOTA_TEACHER_EMAIL = "contest-quota@readingpractice.local";

let quotaClassId: string | undefined;

async function quotaClass(): Promise<string> {
  if (quotaClassId) return quotaClassId;
  const db = getDb();
  let teacher: Teacher | null = await db.getTeacherByEmail(QUOTA_TEACHER_EMAIL);
  if (!teacher) {
    teacher = await db.createTeacher({
      id: newId(),
      email: QUOTA_TEACHER_EMAIL,
      name: "공모전 체험 한도",
      // 비밀번호 로그인은 쓰지 않는다 (아무도 모르는 무작위 값)
      passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
      createdAt: nowIso(),
    });
  }
  let classRoom = (await db.listClasses(teacher.id))[0];
  if (!classRoom) {
    classRoom = await db.createClass({
      id: newId(),
      teacherId: teacher.id,
      name: "공모전 체험 한도",
      gradeLevel: "elem56",
      code: makeClassCode(),
      createdAt: nowIso(),
    });
  }
  quotaClassId = classRoom.id;
  return classRoom.id;
}

export function contestOpen(now = new Date()) {
  return seoulDate(now) <= CONTEST_LAST_DAY;
}

/** 오늘 남은 AI 체험 횟수 */
export async function contestQuota(now = new Date()) {
  const used = contestOpen(now) ? await getDb().getCustomUsage(await quotaClass(), seoulDate(now)) : CONTEST_DAILY_LIMIT;
  return { left: Math.max(0, CONTEST_DAILY_LIMIT - used), limit: CONTEST_DAILY_LIMIT, lastDay: CONTEST_LAST_DAY };
}

/**
 * 한도 안이면 1회를 쓰고 run을 실행한다. 실행이 실패하면 쓴 횟수를 돌려놓는다.
 * 결과와 함께 남은 횟수를 돌려준다.
 */
export async function withContestQuota<T>(run: () => Promise<T>) {
  const now = new Date();
  if (!contestOpen(now)) throw new HttpError(403, `공모전 체험 기간(${CONTEST_LAST_DAY}까지)이 끝났어요.`);
  const db = getDb();
  const classId = await quotaClass();
  const day = seoulDate(now);
  const used = await db.getCustomUsage(classId, day);
  if (used >= CONTEST_DAILY_LIMIT) {
    throw new HttpError(429, `오늘 AI 체험 횟수(${CONTEST_DAILY_LIMIT}회)를 모두 썼어요. 내일 다시 시도해 주세요.`);
  }
  await db.addCustomUsage(classId, day, 1);
  try {
    const result = await run();
    return { result, quota: { left: Math.max(0, CONTEST_DAILY_LIMIT - used - 1), limit: CONTEST_DAILY_LIMIT, lastDay: CONTEST_LAST_DAY } };
  } catch (error) {
    await db.addCustomUsage(classId, day, -1).catch(() => {});
    throw error;
  }
}

/** 체험판에 보내는 기사. 체험판은 브라우저에서 바로 채점하므로 정답(보기 글자)과 해설을 함께 보낸다 */
export function contestArticle(a: Pick<Article, "topic" | "title" | "whyItMatters" | "paragraphs" | "vocab" | "quiz" | "keyPoints" | "modelSummary" | "opinionQuestion" | "stances" | "sources">) {
  return {
    topic: a.topic,
    title: a.title,
    whyItMatters: a.whyItMatters,
    paragraphs: a.paragraphs.map(stripGlosses),
    vocab: a.vocab,
    quiz: a.quiz.map(({ type, prompt, sentence, target, choices, answer, explanation }) => ({
      type,
      prompt,
      sentence,
      target,
      choices,
      answer: choices[answer] ?? "",
      explanation,
    })),
    keyPoints: a.keyPoints,
    modelSummary: a.modelSummary,
    opinionQuestion: a.opinionQuestion,
    stances: a.stances,
    sources: a.sources.map((s) => ({ title: s.title, url: s.url })),
  };
}
