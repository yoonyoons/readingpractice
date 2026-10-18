import type { NextRequest } from "next/server";
import { contestArticle, contestQuota } from "@/lib/contest";
import { isGradeLevel } from "@/lib/grades";
import { HttpError, route } from "@/lib/http";
import { weekLabel } from "@/lib/utils";
import { getWeeklySet, readyArticles } from "@/lib/weekly";

/** 공모전 체험판: 서버가 이번 주에 미리 만들어 둔 학년군 기사 (AI를 부르지 않으므로 한도에 세지 않는다) */
export const GET = route(async (req: NextRequest) => {
  const grade = req.nextUrl.searchParams.get("grade") ?? "elem56";
  if (!isGradeLevel(grade)) throw new HttpError(400, "학년군이 올바르지 않아요.");
  const [set, quota] = await Promise.all([getWeeklySet(grade), contestQuota()]);
  return Response.json({ week: weekLabel(), articles: readyArticles(set).map(contestArticle), quota });
});
