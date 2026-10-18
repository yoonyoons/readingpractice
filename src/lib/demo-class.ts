import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { DEMO_OPINIONS, DEMO_TOPICS } from "./demo-data";
import { normalizeDraft } from "./generation";
import { buildClassReport, formatRate, formatScore, type StudentReport } from "./report";
import { emptyReport } from "./report-ai";
import type { Article, ClassRoom, QuizType, StudentComment, StudentRecord, Submission, SummaryAttempt, Worksheet } from "./types";
import { clamp, newId, nowIso, QUIZ_TYPE_LABEL, recentDays, shuffle, weekKey, weekStartIso } from "./utils";

/*
 * 베타 체험용 반의 가상 학생과 결과
 * 체험자가 결과 분석표를 바로 볼 수 있도록 가상 학생 10명과 최근 4주치 퀴즈·요약·생각 나누기 결과, 예시 AI 의견을 랜덤으로 만든다.
 * 가상 학생이 빠졌거나, 학습지가 지워졌거나, 결과가 지난주에 멈춰 있으면 가상 학생을 지우고 처음부터 다시 만든다.
 * 체험자가 직접 넣은 학생·결과는 건드리지 않는다.
 */

/** 가상 학생 이름 (번호 순서). 이 이름으로 가상 학생을 알아본다 */
export const DEMO_STUDENT_NAMES = [
  "김민준",
  "이서연",
  "박도윤",
  "최하은",
  "정시우",
  "강지아",
  "조예준",
  "윤수아",
  "장하준",
  "임지유",
];
/** 체험자가 가상 학생으로 학생 화면에 들어갈 때 쓰는 PIN */
export const DEMO_STUDENT_PIN = "1234";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 4;
/** 몇 주 전 학습지인지(0이 이번 주)와 제목, 예시 기사 번호 */
const WORKSHEETS = [
  { weeksAgo: 0, title: "체험용 시사 학습지", topics: [0, 1] },
  { weeksAgo: 1, title: "체험용 지난 학습지 1", topics: [1, 2] },
  { weeksAgo: 2, title: "체험용 지난 학습지 2", topics: [2, 0] },
  { weeksAgo: 3, title: "체험용 지난 학습지 3", topics: [0, 1] },
];
/** 학생마다 하나씩 섞어 나눠 주는 실력 (0~1). 도움이 필요한 학생도 한두 명 보이게 낮은 값을 넣었다 */
const ABILITIES = [0.93, 0.88, 0.82, 0.76, 0.7, 0.63, 0.56, 0.48, 0.34, 0.2];

/** 생각 나누기 예시 답 (주제 → 입장 순서대로) */
const OPINION_TEXTS: Record<string, string[][]> = {
  "폭염과 온열질환": [
    [
      "더운 날 운동장에서 뛰면 어지러울 수 있어서 실내에서 하는 게 안전해요.",
      "건강이 제일 중요하니까 폭염 특보가 있는 날은 바꿔야 해요.",
      "작년에 체육 시간에 친구가 더워서 힘들어했던 게 생각났어요.",
    ],
    [
      "물을 자주 마시고 그늘에서 쉬면서 하면 괜찮을 것 같아요.",
      "시간을 아침으로 옮기면 운동장에서도 할 수 있어요.",
      "실내는 좁아서 마음껏 뛰기 어려워요.",
    ],
  ],
  "수업 중 스마트폰 사용": [
    [
      "알림이 오면 자꾸 보고 싶어져서 수업에 집중이 안 돼요.",
      "쉬는 시간에 쓰면 되니까 수업 시간에는 넣어 두는 게 좋아요.",
      "친구들이랑 이야기하는 시간이 더 많아질 것 같아요.",
    ],
    [
      "급한 일이 생기면 가족에게 바로 연락해야 해요.",
      "모르는 낱말을 찾을 때 스마트폰이 도움이 돼요.",
      "규칙보다 스스로 조절하는 연습이 더 중요하다고 생각해요.",
    ],
  ],
  "투명 페트병 분리배출": [
    [
      "일회용 컵 쓰레기가 너무 많아서 줄여야 해요.",
      "개인 컵을 쓰면 쓰레기도 줄고 지구도 지킬 수 있어요.",
      "학교에서부터 실천하면 집에서도 습관이 될 거예요.",
    ],
    [
      "컵을 깜빡하고 안 가져온 친구는 물을 못 마실 수 있어요.",
      "금지보다 분리배출을 잘하도록 알려 주는 게 먼저예요.",
      "재활용 컵을 쓰면 괜찮다고 생각해요.",
    ],
  ],
};

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const jitter = (size: number) => (Math.random() * 2 - 1) * size;

/** 예시 기사 하나를 학습지에 넣을 기사로 만든다 (AI·대기 없이) */
function sampleArticle(index: number): Article {
  const sample = DEMO_TOPICS[index];
  return {
    id: newId(),
    topic: sample.topic,
    topicSummary: sample.topicSummary,
    mentionCount: sample.mentionCount,
    status: "ready",
    sources: sample.sources,
    ...normalizeDraft({ ...sample.draft, ...DEMO_OPINIONS[sample.topic] }),
    sourceMode: "demo",
  };
}

/** weeksAgo주 전 그 주 안의 평일 낮 시각. 아직 오지 않은 시각이면 조금 전으로 당긴다 */
function timeInWeek(weeksAgo: number, now: number) {
  const monday = Date.parse(weekStartIso(new Date(now - weeksAgo * 7 * DAY_MS)));
  const time = monday + Math.floor(Math.random() * 5) * DAY_MS + (9 + Math.random() * 7) * 60 * 60 * 1000;
  return Math.min(time, now - (5 + Math.random() * 120) * 60 * 1000);
}

function scoreBreakdown(target: number) {
  const score = clamp(Math.round(target), 5, 98);
  const content = clamp(Math.round(score * 0.5 + jitter(4)), 0, 50);
  const ownWords = clamp(Math.round(score * 0.3 + jitter(4)), 0, 30);
  const sentence = clamp(score - content - ownWords, 0, 20);
  return { score: content + ownWords + sentence, breakdown: { content, ownWords, sentence } };
}

function summaryAttempt(article: Article, ability: number, at: number): SummaryAttempt {
  const { score, breakdown } = scoreBreakdown(ability * 100 + jitter(12));
  const first = article.paragraphs[0]?.split(/(?<=[.!?])\s/)[0] ?? article.title;
  const text =
    score >= 75
      ? article.keyPoints.join(" ")
      : score >= 50
        ? article.keyPoints.slice(0, 2).join(" ")
        : score >= 30
          ? first
          : `${article.topic}에 대한 기사를 읽었다. 재미있었다.`;
  const tier = score >= 75 ? 0 : score >= 50 ? 1 : 2;
  return {
    text,
    submittedAt: new Date(at).toISOString(),
    feedback: {
      score,
      breakdown,
      strengths: pick([
        ["기사의 핵심 내용을 빠짐없이 담았어요.", "중요한 내용을 자기 말로 잘 정리했어요."],
        ["기사의 중심 내용 하나를 잘 찾았어요.", "문장을 끝까지 바르게 썼어요."],
        ["기사를 끝까지 읽고 요약을 써 냈어요.", "기사의 주제를 알고 있어요."],
      ][tier]),
      missing: pick([
        ["조금 더 짧게 줄여 써 보면 더 좋아요.", "빠진 내용이 거의 없어요."],
        ["기사의 마지막 문단 내용이 빠졌어요.", "까닭이나 해결 방법이 빠졌어요."],
        ["기사의 핵심 내용이 대부분 빠졌어요.", "무슨 일이 왜 일어났는지가 빠졌어요."],
      ][tier]),
      advice: pick([
        ["다음에는 내 생각도 한 문장 덧붙여 봐요.", "지금처럼 핵심 낱말을 살려 써 봐요."],
        ["문단마다 중요한 문장에 밑줄을 긋고 이어 써 봐요.", "'왜?'에 대한 답을 한 문장 넣어 봐요."],
        ["문단마다 한 문장씩 중요한 내용을 골라 써 봐요.", "누가, 무엇을, 왜 했는지 먼저 적어 봐요."],
      ][tier]),
      demo: true,
    },
  };
}

/** 한 학생이 한 기사에 남긴 결과. 건너뛴 단계는 비워 둔다 */
function makeSubmission(worksheetId: string, article: Article, studentId: string, ability: number, start: number): Submission {
  const step = (minutes: number) => start + minutes * 60 * 1000;
  const quizAnswers: Submission["quizAnswers"] = {};
  const bonus: Record<QuizType, number> = { blank: 0.08, synonym: -0.08, comprehension: 0 };
  for (const q of article.quiz) {
    const correct = Math.random() < clamp(ability + bonus[q.type] + jitter(0.1), 0.05, 0.98);
    const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.answer);
    quizAnswers[q.id] = { choice: correct ? q.answer : pick(wrong), correct };
  }

  // 실력이 낮을수록 요약까지 마치지 못하는 경우가 많다
  const summaries: SummaryAttempt[] = [];
  if (Math.random() < 0.55 + ability * 0.4) {
    if (Math.random() < 0.3) summaries.push(summaryAttempt(article, ability - 0.15, step(14)));
    summaries.push(summaryAttempt(article, ability, step(20)));
  }

  const texts = OPINION_TEXTS[article.topic];
  const stance = Math.floor(Math.random() * article.stances.length);
  const opinion =
    summaries.length > 0 && article.opinionQuestion && Math.random() < 0.85
      ? {
          stance,
          text: texts?.[stance] ? pick(texts[stance]) : "기사를 읽고 이렇게 생각했어요.",
          submittedAt: new Date(step(25)).toISOString(),
          hidden: false,
        }
      : null;

  return {
    id: newId(),
    worksheetId,
    articleId: article.id,
    studentId,
    readAt: new Date(start).toISOString(),
    quizAnswers,
    quizDoneAt: new Date(step(8)).toISOString(),
    summaries,
    opinion,
    updatedAt: new Date(opinion ? step(25) : summaries.length ? step(20) : step(8)).toISOString(),
  };
}

/** 결과에 맞춘 예시 AI 의견 (AI를 부르지 않는다) */
function sampleComment(s: StudentReport, from: string, to: string): StudentComment {
  const types = (Object.keys(s.quiz.byType) as QuizType[])
    .filter((t) => s.quiz.byType[t].answered > 0)
    .map((t) => ({ label: QUIZ_TYPE_LABEL[t], rate: s.quiz.byType[t].correct / s.quiz.byType[t].answered }))
    .sort((a, b) => a.rate - b.rate);
  const weakest = types[0];
  const strongest = types.at(-1);
  const words = s.quiz.missedWords.slice(0, 3).map((w) => w.word);
  const history = s.summary.history.map((h) => h.score);
  const rising = history.length >= 2 && history.at(-1)! > history[0];
  const good = (s.quiz.rate ?? 0) >= 0.7 || (s.summary.average ?? 0) >= 70;

  const praise = good
    ? pick([
        `어휘 퀴즈를 ${formatRate(s.quiz.rate)}나 맞혔어요. 낱말 뜻을 꼼꼼히 살펴본 덕분이에요.`,
        `요약 평균이 ${formatScore(s.summary.average)}이에요. 기사의 중요한 내용을 잘 골라 냈어요.`,
        strongest ? `'${strongest.label}' 문제를 특히 잘 풀었어요.` : "기사를 끝까지 꼼꼼히 읽었어요.",
      ])
    : rising
      ? `요약 점수가 ${history[0]}점에서 ${history.at(-1)}점으로 올랐어요. 꾸준히 노력한 덕분이에요.`
      : pick(["기사를 끝까지 읽고 퀴즈를 풀어 냈어요.", "어려운 기사도 포기하지 않고 끝까지 읽었어요."]);
  const next =
    weakest && weakest.rate < 0.7
      ? `다음에는 '${weakest.label}' 문제를 풀 때 기사 속 문장을 한 번 더 읽어 봐요.`
      : (s.summary.average ?? 100) < 60
        ? "다음에는 문단마다 중요한 문장 하나씩을 골라 요약해 봐요."
        : "다음 기사에서는 요약 끝에 내 생각도 한 문장 덧붙여 봐요.";

  const memo = [
    `퀴즈 정답률 ${formatRate(s.quiz.rate)}, 요약 평균 ${formatScore(s.summary.average)}${rising ? "(상승 중)" : ""}.`,
    s.recent.needsHelp
      ? "최근 결과가 낮아 기사 읽기 전 낱말 미리 보기와 짝 활동으로 도와주면 좋겠어요."
      : weakest && weakest.rate < 0.7
        ? `${weakest.label} 유형이 약해 문맥에서 뜻을 짐작하는 연습이 필요해요.`
        : "전반적으로 안정적이라 요약에 자기 생각을 덧붙이도록 이끌어 주세요.",
    words.length > 0 && `다시 볼 낱말: ${words.join(", ")}.`,
    "(체험용 예시 의견)",
  ];
  return {
    studentMessage: `${praise} ${next}`,
    teacherMemo: memo.filter(Boolean).join(" "),
    from,
    to,
    createdAt: nowIso(),
  };
}

/** 체험용 반에 가상 학생·학습지·결과·예시 의견이 없거나 오래됐으면 새로 만든다 */
export async function ensureDemoClassData(classRoom: ClassRoom) {
  const db = getDb();
  const now = Date.now();

  // 1) 4주치 학습지 (지워졌으면 다시 만든다)
  const existing = await db.listWorksheets(classRoom.id);
  let worksheetsChanged = false;
  const worksheets: { weeksAgo: number; worksheet: Worksheet }[] = [];
  for (const spec of WORKSHEETS) {
    let worksheet = existing.find((w) => w.title === spec.title);
    if (!worksheet) {
      const createdAt = new Date(Math.min(Date.parse(weekStartIso(new Date(now - spec.weeksAgo * 7 * DAY_MS))), now)).toISOString();
      worksheet = await db.createWorksheet({
        id: newId(),
        classId: classRoom.id,
        title: spec.title,
        status: "published",
        articles: spec.topics.map(sampleArticle),
        createdAt,
        publishedAt: createdAt,
      });
      worksheetsChanged = true;
    }
    worksheets.push({ weeksAgo: spec.weeksAgo, worksheet });
  }

  // 2) 가상 학생이 모두 있고 이번 주 결과가 있으면 그대로 둔다
  const students = await db.listStudents(classRoom.id);
  const fakes = students.filter((s) => DEMO_STUDENT_NAMES.includes(s.name));
  if (!worksheetsChanged && fakes.length === DEMO_STUDENT_NAMES.length) {
    const subs = (await Promise.all(fakes.map((s) => db.listSubmissionsByStudent(s.id)))).flat();
    const latest = subs.reduce((max, s) => (s.updatedAt > max ? s.updatedAt : max), "");
    if (latest && weekKey(new Date(latest)) === weekKey(new Date(now))) return;
  }

  // 3) 가상 학생을 지우고(결과도 함께 지워진다) 다시 만든다
  await Promise.all(fakes.map((s) => db.deleteStudent(s.id)));
  const taken = new Set(students.filter((s) => !fakes.includes(s)).map((s) => s.number));
  const pinHash = await bcrypt.hash(DEMO_STUDENT_PIN, 10);
  const abilities = shuffle(ABILITIES);
  const created: { student: StudentRecord; ability: number }[] = [];
  let number = 0;
  for (const [i, name] of DEMO_STUDENT_NAMES.entries()) {
    do number++;
    while (taken.has(number));
    const student = await db.createStudent({
      id: newId(),
      classId: classRoom.id,
      number,
      name,
      pinHash,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(now - WEEKS * 7 * DAY_MS).toISOString(),
    });
    await db
      .updateStudent(student.id, { lastLoginAt: new Date(timeInWeek(0, now)).toISOString() })
      .catch((e) => console.error("가상 학생의 최근 접속 시각을 저장하지 못했어요", e));
    created.push({ student, ability: clamp(abilities[i] + jitter(0.04), 0.1, 0.97) });
  }

  // 4) 주마다 실력이 조금씩 오르내리게 해서 결과를 만든다. 이번 주는 아직 하지 않은 학생도 있다
  const submissions: Submission[] = [];
  for (const { student, ability } of created) {
    const growth = jitter(0.03) + 0.02;
    for (const { weeksAgo, worksheet } of worksheets) {
      const weekAbility = clamp(ability - growth * weeksAgo + jitter(0.06), 0.05, 0.98);
      for (const article of worksheet.articles) {
        if (Math.random() > (weeksAgo === 0 ? 0.7 : 0.92)) continue;
        submissions.push(makeSubmission(worksheet.id, article, student.id, weekAbility, timeInWeek(weeksAgo, now)));
      }
    }
  }
  for (let i = 0; i < submissions.length; i += 20) {
    await Promise.all(submissions.slice(i, i + 20).map((s) => db.upsertSubmission(s)));
  }

  // 5) 결과 분석표 예시 의견 (체험자가 넣은 학생의 의견은 그대로 둔다)
  const range = recentDays(28, new Date(now));
  const stats = buildClassReport(
    created.map((c) => c.student),
    worksheets.map((w) => w.worksheet),
    submissions,
    range,
  );
  const report = (await db.getClassReport(classRoom.id)) ?? emptyReport(classRoom.id);
  const fakeIds = new Set(fakes.map((s) => s.id));
  const comments = Object.fromEntries(Object.entries(report.comments).filter(([id]) => !fakeIds.has(id)));
  for (const s of stats.students) if (s.articleCount > 0) comments[s.studentId] = sampleComment(s, range.from, range.to);
  await db.saveClassReport({
    ...report,
    comments,
    commentsFrom: range.from,
    commentsTo: range.to,
    completedAt: report.pending ? report.completedAt : nowIso(),
    updatedAt: nowIso(),
  });
}
