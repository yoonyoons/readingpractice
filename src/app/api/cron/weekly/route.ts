import type { NextRequest } from "next/server";
import { runWeeklyDrafts } from "@/lib/weekly";

export const maxDuration = 300;

/** Vercel Cron이 매주 월요일 오전 6시(한국 시간)에 호출한다 (vercel.json) */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? req.headers.get("authorization") === `Bearer ${secret}`
    : process.env.NODE_ENV !== "production";
  if (!authorized) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await runWeeklyDrafts();
    console.log("weekly drafts", result);
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "실패" }, { status: 500 });
  }
}
