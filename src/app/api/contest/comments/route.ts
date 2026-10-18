import { z } from "zod";
import { withContestQuota } from "@/lib/contest";
import { readJson, route } from "@/lib/http";
import type { StudentReport } from "@/lib/report";
import { writeCommentsNow } from "@/lib/report-ai";
import { recentDays } from "@/lib/utils";

export const maxDuration = 120;

const Tally = z.object({ answered: z.number().int().min(0).max(500), correct: z.number().int().min(0).max(500) });
const Score = z.number().min(0).max(100);

const Body = z.object({
  grade: z.enum(["elem34", "elem56", "middle"]),
  students: z
    .array(
      z.object({
        byType: z.object({ blank: Tally, synonym: Tally, comprehension: Tally }),
        missedWords: z.array(z.string().max(20)).max(10),
        summaries: z.array(z.object({ content: Score, ownWords: Score, sentence: Score })).max(10),
      }),
    )
    .min(1)
    .max(12, "학생은 12명까지 보낼 수 있어요."),
});

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** 공모전 체험판: 체험용 반 학생 기록으로 결과 분석표 AI 의견을 바로 만든다 (이름은 받지 않는다) */
export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const range = recentDays(21);
  const reports: StudentReport[] = body.students.map((s, i) => {
    const types = Object.values(s.byType);
    const answered = types.reduce((n, t) => n + t.answered, 0);
    const correct = types.reduce((n, t) => n + Math.min(t.correct, t.answered), 0);
    const scores = s.summaries.map((x) => x.content + x.ownWords + x.sentence);
    return {
      studentId: String(i + 1),
      number: i + 1,
      name: "",
      articleCount: Math.max(s.summaries.length, answered > 0 ? 1 : 0),
      quiz: {
        answered,
        correct,
        rate: answered ? correct / answered : null,
        byType: s.byType,
        missedWords: s.missedWords.map((word) => ({ word, count: 1 })),
      },
      summary: {
        count: scores.length,
        average: avg(scores),
        content: avg(s.summaries.map((x) => x.content)),
        ownWords: avg(s.summaries.map((x) => x.ownWords)),
        sentence: avg(s.summaries.map((x) => x.sentence)),
        history: scores.map((score) => ({ date: range.to, score, title: "" })),
      },
      weekly: [],
      recent: { weeks: 0, quizRate: null, summaryAverage: null, needsHelp: false },
    };
  });

  const { result, quota } = await withContestQuota(() => writeCommentsNow(body.grade, range, reports));
  return Response.json({ comments: result, quota });
});
