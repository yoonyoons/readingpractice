import { z } from "zod";
import { withContestQuota } from "@/lib/contest";
import { gradeSummary } from "@/lib/feedback";
import { GRADES, MAX_SUMMARY_CHARS } from "@/lib/grades";
import { HttpError, readJson, route } from "@/lib/http";
import { checkStudentText } from "@/lib/moderation";

export const maxDuration = 60;

const Body = z.object({
  grade: z.enum(["elem34", "elem56", "middle"]),
  article: z.object({
    title: z.string().max(200),
    paragraphs: z.array(z.string().max(1000)).min(1).max(12),
    keyPoints: z.array(z.string().max(300)).min(1).max(5),
  }),
  text: z.string().max(MAX_SUMMARY_CHARS, `요약은 ${MAX_SUMMARY_CHARS}자까지 쓸 수 있어요.`),
});

/** 공모전 체험판: 학생 요약을 실제 앱과 같은 방식(Claude)으로 채점한다. 기록은 남기지 않는다 */
export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const text = body.text.trim();
  const minChars = GRADES[body.grade].summaryMinChars;
  if (text.length < minChars) throw new HttpError(400, `요약을 ${minChars}자 이상 써 주세요.`);
  const blocked = checkStudentText(text);
  if (blocked) throw new HttpError(400, blocked);

  const { result, quota } = await withContestQuota(() => gradeSummary(body.article, body.grade, text));
  return Response.json({ feedback: result, quota });
});
