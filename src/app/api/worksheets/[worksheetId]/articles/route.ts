import type { NextRequest } from "next/server";
import { z } from "zod";
import { fetchArticle, pastedArticle } from "@/lib/article-fetch";
import { analyzeArticle } from "@/lib/custom";
import { getDb } from "@/lib/db";
import { isDemoTeacher } from "@/lib/demo-account";
import { isDemoGeneration } from "@/lib/env";
import { buildAllArticles, emptyArticle } from "@/lib/generation";
import { ADD_ARTICLE_LOCKED, ADD_ARTICLE_LOCKED_MESSAGE, MAX_ARTICLES_PER_WORKSHEET } from "@/lib/grades";
import { HttpError, readJson, route } from "@/lib/http";
import { requireTeacherWorksheet } from "@/lib/session";

export const maxDuration = 300;

const Body = z.object({
  url: z.string().trim().max(2048, "주소가 너무 길어요.").default(""),
  text: z.string().trim().max(30000, "본문은 3만 자까지 붙여넣을 수 있어요.").default(""),
});

const FULL = `학습지 하나에는 기사를 ${MAX_ARTICLES_PER_WORKSHEET}개까지 넣을 수 있어요.`;

/**
 * 학습지에 기사 추가: 교사가 붙여넣은 기사 주소(또는 본문)로 이 반 학년군에 맞춘 기사를 만들어 학습지 끝에 넣는다.
 * 나만의 학습지 주간 한도에는 세지 않는다. AI 비용이 든 기사가 사라지지 않도록 만들자마자 저장한다.
 */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/worksheets/[worksheetId]/articles">) => {
  const { worksheetId } = await ctx.params;
  const { teacher, classRoom, worksheet } = await requireTeacherWorksheet(worksheetId);
  if (ADD_ARTICLE_LOCKED) throw new HttpError(403, ADD_ARTICLE_LOCKED_MESSAGE);
  const item = await readJson(req, Body);
  if (!item.url && !item.text) throw new HttpError(400, "기사 주소(URL)를 붙여넣어 주세요.");
  if (worksheet.articles.length >= MAX_ARTICLES_PER_WORKSHEET) {
    throw new HttpError(400, `${FULL} 지운 기사가 있다면 먼저 저장한 뒤 추가해 주세요.`);
  }

  // 베타 체험 계정·API 키가 없을 때는 AI 비용이 들지 않도록 예시 기사로 만든다
  const demo = isDemoTeacher(teacher) || isDemoGeneration();
  const fetched = item.text ? pastedArticle(item.text, item.url) : await fetchArticle(item.url);
  if (fetched.text.replace(/\s/g, "").length < 150) {
    throw new HttpError(
      422,
      "기사 본문을 가져오지 못했어요. 유료·로그인 기사이거나 화면을 나중에 불러오는 사이트일 수 있어요. '본문 직접 붙여넣기'로 기사 내용을 넣어 주세요.",
    );
  }
  const topic = await analyzeArticle(fetched, demo);
  const [article] = await buildAllArticles([{ ...emptyArticle(topic), sourceMode: "url" }], classRoom.gradeLevel, undefined, demo);

  // 만드는 동안 바뀌었을 수 있으므로 최신 학습지 끝에 붙인다
  const db = getDb();
  const fresh = (await db.getWorksheet(worksheetId)) ?? worksheet;
  if (fresh.articles.length >= MAX_ARTICLES_PER_WORKSHEET) throw new HttpError(400, FULL);
  await db.updateWorksheet(worksheetId, { articles: [...fresh.articles, article] });
  return Response.json({ article });
});
