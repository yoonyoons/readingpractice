import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { isDemoTeacher } from "@/lib/demo-account";
import { buildAllArticles } from "@/lib/generation";
import { HttpError, route } from "@/lib/http";
import { requireTeacherWorksheet } from "@/lib/session";

export const maxDuration = 300;

export const POST = route(
  async (_req: NextRequest, ctx: RouteContext<"/api/worksheets/[worksheetId]/articles/[articleId]/regenerate">) => {
    const { worksheetId, articleId } = await ctx.params;
    const { teacher, classRoom, worksheet } = await requireTeacherWorksheet(worksheetId);
    const article = worksheet.articles.find((a) => a.id === articleId);
    if (!article) throw new HttpError(404, "기사를 찾을 수 없어요.");

    const [updated] = await buildAllArticles([article], classRoom.gradeLevel, undefined, isDemoTeacher(teacher) || undefined);

    // 생성하는 동안 바뀌었을 수 있으므로 최신 학습지에 이 기사만 바꿔 넣는다
    const db = getDb();
    const fresh = (await db.getWorksheet(worksheetId)) ?? worksheet;
    await db.updateWorksheet(worksheetId, {
      articles: fresh.articles.map((a) => (a.id === articleId ? updated : a)),
    });
    return Response.json({ article: updated });
  },
);
