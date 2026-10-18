import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { MAX_ARTICLES_PER_WORKSHEET } from "@/lib/grades";
import { HttpError, readJson, route } from "@/lib/http";
import { requireTeacherWorksheet } from "@/lib/session";
import { remoteBuild } from "../app/contest-api";

/*
 * src/app/api/worksheets/[worksheetId]/articles/route.ts 의 체험판.
 * 기사 주소를 가져와 분석하고 기사·퀴즈를 쓰는 일을 실제 서버의 공모전 API(Claude)에 맡긴다.
 */

const Body = z.object({
  url: z.string().trim().max(2048, "주소가 너무 길어요.").default(""),
  text: z.string().trim().max(30000, "본문은 3만 자까지 붙여넣을 수 있어요.").default(""),
});

const FULL = `학습지 하나에는 기사를 ${MAX_ARTICLES_PER_WORKSHEET}개까지 넣을 수 있어요.`;

export const POST = route(async (req: NextRequest, ctx: { params: Promise<{ worksheetId: string }> }) => {
  const { worksheetId } = await ctx.params;
  const { classRoom, worksheet } = await requireTeacherWorksheet(worksheetId);
  const item = await readJson(req, Body);
  if (!item.url && !item.text) throw new HttpError(400, "기사 주소(URL)를 붙여넣어 주세요.");
  if (worksheet.articles.length >= MAX_ARTICLES_PER_WORKSHEET) {
    throw new HttpError(400, `${FULL} 지운 기사가 있다면 먼저 저장한 뒤 추가해 주세요.`);
  }

  const article = await remoteBuild(classRoom.gradeLevel, item);

  const db = getDb();
  const fresh = (await db.getWorksheet(worksheetId)) ?? worksheet;
  if (fresh.articles.length >= MAX_ARTICLES_PER_WORKSHEET) throw new HttpError(400, FULL);
  await db.updateWorksheet(worksheetId, { articles: [...fresh.articles, article] });
  return Response.json({ article });
});
