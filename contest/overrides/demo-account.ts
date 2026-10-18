import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { buildAllArticles, cloneArticles, emptyArticle, pickTopics } from "@/lib/generation";
import type { Article, ClassRoom, StudentRecord, Submission, Teacher, Worksheet } from "@/lib/types";
import { makeClassCode, newId, weekTitle } from "@/lib/utils";
import { remoteWeekly } from "../app/contest-api";

/*
 * 체험판의 체험 계정.
 * 실제 서비스의 베타 계정과 달리 AI 기능을 실제 서버로 부르므로 '체험 계정' 표시(예시 기사 안내)는 쓰지 않는다.
 * 결과 분석표를 바로 볼 수 있게 지난 3주 학습지와 가상 학생 10명의 학습 기록을 무작위로 만들어 둔다.
 */

export const DEMO_TEACHER_EMAIL = "beta-demo@readingpractice.local";
export const DEMO_CLASS_NAME = "체험용 반";
export const DEMO_STUDENTS = 10;
/** 가상 학생의 PIN (학생 화면 체험 안내에 보여 준다) */
export const DEMO_PIN = "1234";

export function isDemoTeacher(teacher: Pick<Teacher, "email">) {
  void teacher;
  return false;
}

const DAY = 24 * 60 * 60 * 1000;
const FAMILY = "김이박최정강조윤장임한오서신권황안송".split("");
const GIVEN = ["하늘", "도윤", "서연", "지호", "하은", "민준", "수아", "지우", "예린", "시우", "유나", "건우", "서준", "다은", "준서", "채원", "현우", "지아"];
const REASONS = [
  "기사를 읽어 보니 우리 생활과 가까운 일이라고 느꼈어요. 그래서 이렇게 생각해요.",
  "모두가 함께 지키면 더 좋아질 것 같아요. 작은 실천부터 시작하면 돼요.",
  "다른 입장도 이해되지만 안전과 건강이 더 중요하다고 생각해요.",
  "규칙만 만드는 것보다 스스로 조절하는 습관이 더 중요하다고 생각해요.",
  "어려운 점도 있지만 해 볼 만한 가치가 있다고 생각해요.",
  "친구들과 이야기해 보니 생각이 조금 바뀌었어요. 양쪽 모두 일리가 있어요.",
];

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const chance = (p: number) => Math.random() < Math.min(0.97, Math.max(0.03, p));
const iso = (time: number) => new Date(time).toISOString();

function shuffled<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

/** 학생 한 명이 기사 하나를 공부한 기록 (실력 level 0~1) */
function makeSubmission(worksheet: Worksheet, article: Article, student: StudentRecord, level: number, at: number, finish: boolean): Submission {
  const quizAnswers: Submission["quizAnswers"] = {};
  for (const q of article.quiz) {
    const correct = chance(level + (Math.random() - 0.5) * 0.25);
    const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.answer);
    quizAnswers[q.id] = { choice: correct ? q.answer : pick(wrong), correct };
  }
  const attempts = finish ? (level < 0.5 && chance(0.6) ? 2 : 1) : 0;
  const summaries = Array.from({ length: attempts }, (_, k) => {
    const q = Math.min(1, Math.max(0.08, level + k * 0.08 + (Math.random() - 0.5) * 0.2));
    const content = Math.round(50 * q);
    const ownWords = Math.round(30 * Math.min(1, Math.max(0.1, q + (Math.random() - 0.5) * 0.2)));
    const sentence = Math.round(20 * Math.min(1, q + 0.15));
    return {
      text: q > 0.5 ? article.modelSummary : (article.paragraphs[0] ?? "").slice(0, 80),
      submittedAt: iso(at + (k + 1) * 10 * 60 * 1000),
      feedback: {
        score: content + ownWords + sentence,
        breakdown: { content, ownWords, sentence },
        strengths: q > 0.5 ? "기사의 핵심 내용을 빠짐없이 담았어요." : "끝까지 스스로 요약문을 완성했어요.",
        missing: q > 0.5 ? "문장끼리 자연스럽게 이어지도록 다듬어 보세요." : `'${article.keyPoints[0] ?? ""}' 같은 내용도 넣어 보면 더 좋아요.`,
        advice: q > 0.5 ? "까닭과 결과를 한 문장씩 더 넣어 보세요." : "기사 문장을 그대로 옮기기보다 내 말로 바꾸어 써 보세요.",
      },
    };
  });
  return {
    id: newId(),
    worksheetId: worksheet.id,
    articleId: article.id,
    studentId: student.id,
    readAt: iso(at),
    quizAnswers,
    quizDoneAt: iso(at + 5 * 60 * 1000),
    summaries,
    opinion:
      finish && article.opinionQuestion
        ? { stance: Math.floor(Math.random() * article.stances.length), text: pick(REASONS), submittedAt: iso(at + 30 * 60 * 1000), hidden: false }
        : null,
    updatedAt: iso(at + 30 * 60 * 1000),
  };
}

async function seed(): Promise<Teacher> {
  const db = getDb();
  const now = Date.now();
  const teacher = await db.createTeacher({
    id: newId(),
    email: DEMO_TEACHER_EMAIL,
    name: "체험",
    passwordHash: "",
    createdAt: iso(now - 21 * DAY),
  });
  let code = makeClassCode();
  for (let i = 0; i < 5 && (await db.getClassByCode(code)); i++) code = makeClassCode();
  const classRoom: ClassRoom = await db.createClass({
    id: newId(),
    teacherId: teacher.id,
    name: DEMO_CLASS_NAME,
    gradeLevel: "elem56",
    code,
    createdAt: iso(now - 21 * DAY),
  });

  // 지난 두 주는 예시 기사, 이번 주는 실제 서버가 만든 이번 주 기사(못 받으면 예시 기사)
  const samples = await buildAllArticles((await pickTopics(3, true)).map(emptyArticle), classRoom.gradeLevel, undefined, true);
  const thisWeek = await remoteWeekly(classRoom.gradeLevel).catch(() => [] as Article[]);
  const weeks = [
    { at: now - 14 * DAY, articles: cloneArticles([samples[0], samples[1]]) },
    { at: now - 7 * DAY, articles: cloneArticles([samples[2], samples[0]]) },
    { at: now - 2 * 60 * 60 * 1000, articles: thisWeek.length ? cloneArticles(thisWeek) : cloneArticles([samples[1], samples[2]]) },
  ];
  const worksheets: Worksheet[] = [];
  for (const w of weeks) {
    worksheets.push(
      await db.createWorksheet({
        id: newId(),
        classId: classRoom.id,
        title: weekTitle(new Date(w.at)),
        status: "published",
        articles: w.articles,
        createdAt: iso(w.at - 60 * 60 * 1000),
        publishedAt: iso(w.at),
      }),
    );
  }

  // 가상 학생 10명: 실력을 고르게 나누고, 두 명은 '도움 필요'가 보이도록 낮게
  const levels = shuffled([0.12, 0.2, 0.45, 0.55, 0.6, 0.68, 0.74, 0.8, 0.86, 0.93]);
  const names = shuffled(GIVEN).slice(0, DEMO_STUDENTS);
  const pinHash = await bcrypt.hash(DEMO_PIN, 10);
  for (let n = 0; n < DEMO_STUDENTS; n++) {
    const student = await db.createStudent({
      id: newId(),
      classId: classRoom.id,
      number: n + 1,
      name: pick(FAMILY) + names[n],
      pinHash,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: iso(now - 21 * DAY),
      lastLoginAt: iso(now - Math.random() * 3 * DAY),
    });
    for (const [wi, worksheet] of worksheets.entries()) {
      const current = wi === worksheets.length - 1;
      // 이번 주 학습지는 절반쯤만 시작했다
      if (current && !chance(0.55)) continue;
      for (const [ai, article] of worksheet.articles.entries()) {
        if (current && ai > 0 && !chance(0.5)) continue;
        const at = weeks[wi].at + (1 + Math.random() * 3) * (current ? 0.3 : 1) * 60 * 60 * 1000 + ai * DAY * 0.2;
        await db.upsertSubmission(makeSubmission(worksheet, article, student, levels[n], Math.min(at, now - 60 * 1000), !current || chance(0.7)));
      }
    }
  }
  return teacher;
}

let seeding: Promise<Teacher> | null = null;

/** 체험 계정과 체험용 반이 없으면 만들고, 계정을 돌려준다 */
export async function ensureDemoTeacher(): Promise<Teacher> {
  const existing = await getDb().getTeacherByEmail(DEMO_TEACHER_EMAIL);
  if (existing) {
    return { id: existing.id, email: existing.email, name: existing.name, createdAt: existing.createdAt };
  }
  seeding ??= seed().finally(() => (seeding = null));
  return seeding;
}

/** 체험용 반 (학생 화면 안내에 반 코드를 보여 주려고) */
export async function demoClass(): Promise<ClassRoom | null> {
  const teacher = await getDb().getTeacherByEmail(DEMO_TEACHER_EMAIL);
  return teacher ? ((await getDb().listClasses(teacher.id))[0] ?? null) : null;
}
