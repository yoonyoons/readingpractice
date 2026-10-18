import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { HttpError, route } from "@/lib/http";
import { requireTeacherWorksheet } from "@/lib/session";
import { remoteBuild } from "../app/contest-api";

/*
 * src/app/api/worksheets/[worksheetId]/articles/[articleId]/regenerate/route.ts 의 체험판.
 * 기사의 재료(뉴스에서 확인한 사실, 없으면 지금 본문)를 실제 서버의 공모전 API에 보내 다시 쓴다.
 */
export const POST = route(async (_req: NextRequest, ctx: { params: Promise<{ worksheetId: string; articleId: string }> }) => {
  const { worksheetId, articleId } = await ctx.params;
  const { classRoom, worksheet } = await requireTeacherWorksheet(worksheetId);
  const article = worksheet.articles.find((a) => a.id === articleId);
  if (!article) throw new HttpError(404, "기사를 찾을 수 없어요.");

  const material = [article.topic, article.topicSummary, ...(article.facts?.length ? article.facts : article.paragraphs)]
    .filter(Boolean)
    .join("\n");
  const built = await remoteBuild(classRoom.gradeLevel, { url: "", text: material });
  const updated = { ...built, id: article.id, sources: article.sources.length ? article.sources : built.sources, sourceMode: article.sourceMode };

  const db = getDb();
  const fresh = (await db.getWorksheet(worksheetId)) ?? worksheet;
  await db.updateWorksheet(worksheetId, {
    articles: fresh.articles.map((a) => (a.id === articleId ? updated : a)),
  });
  return Response.json({ article: updated });
});
