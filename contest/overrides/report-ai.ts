import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { buildClassReport, type DateRange, type StudentReport } from "@/lib/report";
import type { ClassRoom, StudentComment } from "@/lib/types";
import { clamp, nowIso } from "@/lib/utils";
// @ts-expect-error 원래 모듈 (빌드 스크립트가 진짜 src/lib/report-ai.ts로 연결한다)
import * as orig from "orig:@/lib/report-ai";
import { remoteComments, type RemoteStudent } from "../app/contest-api";
import { toast } from "../app/toast";
import { withoutAi } from "./env";

export const { emptyReport, collectReportComments, loadClassReport, collectPendingReports, writeCommentsNow } = orig;

/** 공모전 API가 한 번에 받는 학생 수 */
const CHUNK = 12;

/** 학생 기록을 공모전 API 형식으로: 요약은 영역별 평균을 회차 점수에 맞춰 나눈다 */
function toRemote(s: StudentReport): RemoteStudent {
  const avg = s.summary.average ?? 0;
  return {
    byType: s.quiz.byType,
    missedWords: s.quiz.missedWords.slice(0, 10).map((w) => w.word.slice(0, 20)),
    summaries: s.summary.history.slice(-10).map((h) => {
      const r = avg ? h.score / avg : 0;
      return {
        content: clamp(Math.round((s.summary.content ?? 0) * r), 0, 50),
        ownWords: clamp(Math.round((s.summary.ownWords ?? 0) * r), 0, 30),
        sentence: clamp(Math.round((s.summary.sentence ?? 0) * r), 0, 20),
      };
    }),
  };
}

/**
 * 결과 분석표 AI 의견: 실제 서버(Claude)로 고른 학생들의 의견을 바로 만든다.
 * 서버를 부르지 못하면 원래 앱의 규칙 기반 의견으로 대신한다.
 */
export async function requestReportComments(classRoom: ClassRoom, range: DateRange, demo: boolean, studentIds: string[]) {
  const db = getDb();
  const [students, worksheets, saved] = await Promise.all([
    db.listStudents(classRoom.id),
    db.listWorksheets(classRoom.id),
    db.getClassReport(classRoom.id),
  ]);
  if (students.length === 0) throw new HttpError(400, "아직 반에 학생이 없어요.");
  const picked = new Set(studentIds);
  const submissions = (await Promise.all(worksheets.map((w) => db.listSubmissionsByWorksheet(w.id)))).flat();
  const stats = buildClassReport(
    students.filter((s) => picked.has(s.id)),
    worksheets,
    submissions,
    range,
  );
  const active = stats.students.filter((s) => s.articleCount > 0);
  if (active.length === 0) throw new HttpError(400, "고른 학생 중 이 기간에 기록이 있는 학생이 없어요.");

  try {
    const made: Record<string, StudentComment> = {};
    for (let i = 0; i < active.length; i += CHUNK) {
      const group = active.slice(i, i + CHUNK);
      const comments = await remoteComments(classRoom.gradeLevel, group.map(toRemote));
      group.forEach((s, j) => {
        if (comments[j]) made[s.studentId] = { ...comments[j], from: range.from, to: range.to };
      });
    }
    const report = saved ?? emptyReport(classRoom.id);
    const now = nowIso();
    return await db.saveClassReport({
      ...report,
      comments: { ...report.comments, ...made },
      commentsFrom: range.from,
      commentsTo: range.to,
      completedAt: now,
      pending: null,
      error: null,
      updatedAt: now,
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 400) throw error;
    toast(`${error instanceof Error ? error.message : "AI 의견을 만들지 못했어요."} 이번에는 규칙으로 예시 의견을 만들었어요.`);
    return withoutAi(() => orig.requestReportComments(classRoom, range, true, studentIds));
  }
}
