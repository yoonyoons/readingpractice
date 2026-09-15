import type { NextRequest } from "next/server";
import { runWeeklyJob } from "@/lib/weekly";

export const maxDuration = 300;

/**
 * 이번 주 기사 준비. Vercel Cron이 월요일 오전 4시에 만들고, 매일 오전 6시에 빠지거나 실패한 것을 채운다 (한국 시간, vercel.json).
 * 이미 모두 준비돼 있으면 AI를 부르지 않는다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? req.headers.get("authorization") === `Bearer ${secret}`
    : process.env.NODE_ENV !== "production";
  if (!authorized) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await runWeeklyJob();
    console.log("weekly articles", JSON.stringify(result));
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "실패" }, { status: 500 });
  }
}
