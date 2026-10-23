import type { NextRequest } from "next/server";
import { runLibraryJob } from "@/lib/library-job";
import { collectPendingReports } from "@/lib/report-ai";
import { runWeeklyJob } from "@/lib/weekly";

export const maxDuration = 300;

/**
 * Vercel Cron (vercel.json): 월요일 오전 4시에 이번 주 기사를 만들고, 매일 오전 6시에 빠지거나 실패한 기사를 채운다 (한국 시간).
 * 이미 모두 준비돼 있으면 AI를 부르지 않는다. 결과 분석표 AI 의견(Batch)이 도착했으면 함께 가져온다.
 * 관심 분야 학습 기사도 이번 주 분야별 1편이 아직 없으면 화요일부터 만든다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? req.headers.get("authorization") === `Bearer ${secret}`
    : process.env.NODE_ENV !== "production";
  if (!authorized) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [weekly, reports, library] = await Promise.allSettled([runWeeklyJob(), collectPendingReports(), runLibraryJob()]);
  const result = {
    weekly: weekly.status === "fulfilled" ? weekly.value : { error: errorText(weekly.reason) },
    reports: reports.status === "fulfilled" ? reports.value : { error: errorText(reports.reason) },
    library: library.status === "fulfilled" ? library.value : { error: errorText(library.reason) },
  };
  console.log("cron", JSON.stringify(result));
  const failed = weekly.status === "rejected" || reports.status === "rejected" || library.status === "rejected";
  return Response.json(result, { status: failed ? 500 : 200 });
}

function errorText(reason: unknown) {
  console.error(reason);
  return reason instanceof Error ? reason.message : "실패";
}
