import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { buildArticle } from "@/lib/generation";
import { HttpError, route } from "@/lib/http";
import { requireTeacherWorksheet } from "@/lib/session";
import type { Article } from "@/lib/types";

export const maxDuration = 300;

export const POST = route(
  async (_req: NextRequest, ctx: RouteContext<"/api/worksheets/[worksheetId]/articles/[articleId]/regenerate">) => {
    const { worksheetId, articleId } = await ctx.params;
    const { classRoom, worksheet } = await requireTeacherWorksheet(worksheetId);
    const article = worksheet.articles.find((a) => a.id === articleId);
    if (!article) throw new HttpError(404, "기사를 찾을 수 없어요.");

    let updated: Article;
    try {
      const built = await buildArticle(
        { name: article.topic, summary: article.topicSummary, sources: article.sources },
        classRoom.gradeLevel,
      );
      updated = { ...article, ...built, status: "ready", error: undefined };
    } catch (error) {
      updated = { ...article, status: "failed", error: error instanceof Error ? error.message : "알 수 없는 오류" };
    }

    // 생성하는 동안 바뀌었을 수 있으므로 최신 학습지에 이 기사만 바꿔 넣는다
    const db = getDb();
    const fresh = (await db.getWorksheet(worksheetId)) ?? worksheet;
    await db.updateWorksheet(worksheetId, {
      articles: fresh.articles.map((a) => (a.id === articleId ? updated : a)),
    });
    return Response.json({ article: updated });
  },
);
