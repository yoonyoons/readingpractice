import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ai } from "./claude";
import { getDb } from "./db";
import { hasAnthropic } from "./env";
import { GRADES } from "./grades";
import { HttpError } from "./http";
import { buildClassReport, formatRate, formatScore, type DateRange, type StudentReport } from "./report";
import type { ClassReport, ClassRoom, GradeLevel, QuizType, StudentComment } from "./types";
import { clean, nowIso, QUIZ_TYPE_LABEL } from "./utils";

/*
 * 결과 분석표 AI 의견
 * 비용을 줄이려고 가장 저렴한 모델(Claude Haiku 4.5)을 Batch API(요금 50%, 결과는 몇 분~최대 24시간 뒤)로 부른다.
 * 학생 10명씩 한 요청에 묶어 지시문을 나눠 쓰고, 학생 이름·번호 대신 key만 보낸다.
 * 결과는 교사가 분석표를 열 때, 학생이 홈을 열 때(1분에 한 번), 매일 아침 Cron에서 가져온다.
 */

const COMMENT_MODEL = "claude-haiku-4-5";
const GROUP_SIZE = 10;
const CHECK_INTERVAL_MS = 60 * 1000;

const CommentsSchema = z.object({
  comments: z.array(z.object({ key: z.string(), studentMessage: z.string(), teacherMemo: z.string() })),
});

const SYSTEM =
  "너는 초·중학교 선생님을 돕는 학습 분석 도우미다. 주어진 학습 기록 수치만 근거로 쓰고, 기록에 없는 사실(성격·태도·가정환경 등)을 지어내지 않는다.";

const NO_RECORD: StudentComment = { studentMessage: "", teacherMemo: "이 기간에 제출한 어휘 퀴즈·요약이 없어요." };

export function emptyReport(classId: string): ClassReport {
  return {
    classId,
    comments: {},
    commentsFrom: null,
    commentsTo: null,
    completedAt: null,
    pending: null,
    error: null,
    updatedAt: nowIso(),
  };
}

const round = (value: number | null) => (value === null ? "-" : String(Math.round(value)));

function typeRates(s: StudentReport) {
  return (Object.keys(s.quiz.byType) as QuizType[])
    .filter((t) => s.quiz.byType[t].answered > 0)
    .map((t) => ({ label: QUIZ_TYPE_LABEL[t], rate: s.quiz.byType[t].correct / s.quiz.byType[t].answered }));
}

/** AI에 보내는 학생 한 명의 기록 (수치와 틀린 낱말만) */
function describe(s: StudentReport) {
  const parts: string[] = [];
  if (s.quiz.answered > 0) {
    const types = typeRates(s)
      .map((t) => `${t.label} ${formatRate(t.rate)}`)
      .join(", ");
    parts.push(`어휘 퀴즈 ${s.quiz.answered}문항 중 ${s.quiz.correct}개 정답(${formatRate(s.quiz.rate)}; ${types})`);
    if (s.quiz.missedWords.length) parts.push(`틀린 낱말: ${s.quiz.missedWords.slice(0, 5).map((w) => w.word).join(", ")}`);
  } else {
    parts.push("어휘 퀴즈 기록 없음");
  }
  if (s.summary.count > 0) {
    parts.push(
      `요약 ${s.summary.count}번 평균 ${formatScore(s.summary.average)}(핵심 내용 ${round(s.summary.content)}/50, 내 말로 표현 ${round(s.summary.ownWords)}/30, 문장 완성도 ${round(s.summary.sentence)}/20), 점수 변화 ${s.summary.history.map((h) => h.score).join("→")}`,
    );
  } else {
    parts.push("요약 기록 없음");
  }
  return parts.join(" · ");
}

function prompt(grade: GradeLevel, range: DateRange, lines: string[]) {
  const g = GRADES[grade];
  return `[학년군] ${g.label}
[기간] ${range.from} ~ ${range.to}

아래는 시사 기사 학습지에서 학생들이 푼 어휘 퀴즈와 요약의 기록이다. 줄 맨 앞의 숫자가 학생을 구분하는 key다 (이름은 보내지 않았다).
${lines.join("\n")}

모든 key마다 하나씩 작성하라.
- key: 입력의 숫자를 그대로 쓴다.
- studentMessage: 학생 본인이 읽는 2~3문장. ${g.label} 학생에게 말하듯 따뜻한 존댓말('~했어요')로 쓴다. 기록에서 잘한 점 한 가지를 구체적으로 칭찬하고, 다음에 해 볼 한 가지를 쉽게 제안한다. 다른 친구와 비교하거나 점수로 꾸짖지 않는다.
- teacherMemo: 선생님만 보는 2~3문장. 강점, 보완할 점(퀴즈 유형·요약 영역·틀린 낱말), 수업에서 해 볼 지도 방법을 짧게 쓴다.
- 기록에 없는 사실은 쓰지 않는다. HTML 태그나 마크다운 기호는 쓰지 않는다.`;
}

/** 베타 체험 계정·API 키가 없을 때 AI 대신 쓰는 규칙 기반 의견 */
function ruleComment(s: StudentReport): StudentComment {
  const weakest = typeRates(s).sort((a, b) => a.rate - b.rate)[0];
  const words = s.quiz.missedWords.slice(0, 3).map((w) => w.word);
  const done = [
    s.quiz.rate !== null && `어휘 퀴즈를 ${formatRate(s.quiz.rate)} 맞혔어요.`,
    s.summary.average !== null && `요약은 평균 ${formatScore(s.summary.average)}을 받았어요.`,
  ].filter(Boolean);
  return {
    studentMessage: [
      ...done,
      weakest && weakest.rate < 1 ? `다음에는 '${weakest.label}' 문제를 한 번 더 살펴봐요.` : "다음 기사도 끝까지 읽고 내 말로 요약해 봐요.",
    ].join(" "),
    teacherMemo: [
      `퀴즈 정답률 ${formatRate(s.quiz.rate)}, 요약 평균 ${formatScore(s.summary.average)}.`,
      weakest && weakest.rate < 1 && `${weakest.label} 유형 보완이 필요해요.`,
      words.length > 0 && `다시 볼 낱말: ${words.join(", ")}.`,
      "(예시 의견: AI를 부르지 않고 규칙으로 만들었어요)",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * 기간 안의 결과로 반 학생 모두의 의견을 요청한다.
 * 기록이 없는 학생은 AI를 부르지 않고 정해진 메모를 쓰고, 데모면 규칙으로 바로 만든다.
 */
export async function requestReportComments(classRoom: ClassRoom, range: DateRange, demo: boolean) {
  const db = getDb();
  const [students, worksheets, saved] = await Promise.all([
    db.listStudents(classRoom.id),
    db.listWorksheets(classRoom.id),
    db.getClassReport(classRoom.id),
  ]);
  if (students.length === 0) throw new HttpError(400, "아직 반에 학생이 없어요.");
  const report = saved ?? emptyReport(classRoom.id);
  if (report.pending) throw new HttpError(409, "AI 의견을 만들고 있어요. 결과가 도착한 뒤에 다시 만들어 주세요.");

  const submissions = (await Promise.all(worksheets.map((w) => db.listSubmissionsByWorksheet(w.id)))).flat();
  const stats = buildClassReport(students, worksheets, submissions, range);
  const useAi = !demo && hasAnthropic();

  const presets: Record<string, StudentComment> = {};
  const active: StudentReport[] = [];
  for (const s of stats.students) {
    if (s.articleCount === 0) presets[s.studentId] = NO_RECORD;
    else if (!useAi) presets[s.studentId] = ruleComment(s);
    else active.push(s);
  }

  const now = nowIso();
  if (active.length === 0) {
    return db.saveClassReport({
      ...report,
      comments: presets,
      commentsFrom: range.from,
      commentsTo: range.to,
      completedAt: now,
      error: null,
      updatedAt: now,
    });
  }

  const groups: Record<string, string[]> = {};
  const requests: Anthropic.Messages.BatchCreateParams.Request[] = [];
  for (let i = 0; i < active.length; i += GROUP_SIZE) {
    const group = active.slice(i, i + GROUP_SIZE);
    const customId = `group-${i / GROUP_SIZE + 1}`;
    groups[customId] = group.map((s) => s.studentId);
    requests.push({
      custom_id: customId,
      params: {
        model: COMMENT_MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: prompt(
              classRoom.gradeLevel,
              range,
              group.map((s, j) => `${j + 1}: ${describe(s)}`),
            ),
          },
        ],
        output_config: { format: zodOutputFormat(CommentsSchema) },
      },
    });
  }

  const batch = await ai().messages.batches.create({ requests });
  return db.saveClassReport({
    ...report,
    pending: { batchId: batch.id, from: range.from, to: range.to, requestedAt: now, checkedAt: now, groups, presets },
    error: null,
    updatedAt: now,
  });
}

function parseComments(message: Anthropic.Messages.Message) {
  if (message.stop_reason === "max_tokens" || message.stop_reason === "refusal") return null;
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  try {
    const parsed = CommentsSchema.safeParse(JSON.parse(block.text));
    return parsed.success ? parsed.data.comments : null;
  } catch {
    return null;
  }
}

/** 만드는 중인 의견의 Batch가 끝났으면 결과를 가져와 저장한다. throttle이면 1분 안에 다시 확인하지 않는다 */
export async function collectReportComments(report: ClassReport, throttle = false): Promise<ClassReport> {
  const pending = report.pending;
  if (!pending) return report;
  if (throttle && Date.now() - Date.parse(pending.checkedAt) < CHECK_INTERVAL_MS) return report;

  const db = getDb();
  const now = nowIso();
  let batch: Anthropic.Messages.MessageBatch;
  try {
    batch = await ai().messages.batches.retrieve(pending.batchId);
  } catch (error) {
    if (!(error instanceof Anthropic.NotFoundError)) throw error;
    return db.saveClassReport({ ...report, pending: null, error: "AI 의견 요청을 찾을 수 없어요. 다시 만들어 주세요.", updatedAt: now });
  }
  if (batch.processing_status !== "ended") {
    return db.saveClassReport({ ...report, pending: { ...pending, checkedAt: now }, updatedAt: now });
  }

  const comments: Record<string, StudentComment> = { ...pending.presets };
  let written = 0;
  for await (const item of await ai().messages.batches.results(pending.batchId)) {
    const ids = pending.groups[item.custom_id];
    const parsed = ids && item.result.type === "succeeded" ? parseComments(item.result.message) : null;
    if (!ids || !parsed) continue;
    for (const c of parsed) {
      const id = ids[Number(c.key.match(/\d+/)?.[0]) - 1];
      if (!id || comments[id]) continue;
      comments[id] = { studentMessage: clean(c.studentMessage), teacherMemo: clean(c.teacherMemo) };
      written++;
    }
  }

  const expected = Object.values(pending.groups).flat().length;
  const missing = expected - written;
  if (written === 0) {
    // 하나도 만들지 못했으면 지난 의견을 그대로 둔다
    return db.saveClassReport({ ...report, pending: null, error: "AI 의견을 만들지 못했어요. 다시 만들어 주세요.", updatedAt: now });
  }
  return db.saveClassReport({
    ...report,
    comments,
    commentsFrom: pending.from,
    commentsTo: pending.to,
    completedAt: now,
    pending: null,
    error: missing > 0 ? `학생 ${missing}명의 의견을 만들지 못했어요. 다시 만들면 채워져요.` : null,
    updatedAt: now,
  });
}

/** 반의 AI 의견을 읽는다. 만드는 중이면 끝났는지 확인해 가져오고, 확인이 실패해도 저장된 내용을 돌려준다 */
export async function loadClassReport(classId: string, throttle = false): Promise<ClassReport | null> {
  const report = await getDb().getClassReport(classId);
  if (!report?.pending) return report;
  try {
    return await collectReportComments(report, throttle);
  } catch (error) {
    console.error("[report] Batch 결과 확인 실패", error);
    return report;
  }
}

/** Cron: 결과를 기다리는 모든 반의 Batch를 확인한다 */
export async function collectPendingReports() {
  const reports = await getDb().listPendingClassReports();
  let collected = 0;
  for (const report of reports) {
    try {
      if (!(await collectReportComments(report)).pending) collected++;
    } catch (error) {
      console.error("[report] Batch 결과 확인 실패", report.classId, error);
    }
  }
  return { pending: reports.length, collected };
}
