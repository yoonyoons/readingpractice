import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { ArticleSchema } from "@/lib/schemas";
import { requireTeacherWorksheet } from "@/lib/session";
import { nowIso } from "@/lib/utils";

type Ctx = RouteContext<"/api/worksheets/[worksheetId]">;

const Body = z.object({
  title: z.string().trim().min(1, "학습지 제목을 입력해 주세요.").max(60).optional(),
  articles: z.array(ArticleSchema).optional(),
  status: z.enum(["draft", "published"]).optional(),
});

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const { worksheetId } = await ctx.params;
  const { worksheet } = await requireTeacherWorksheet(worksheetId);
  const body = await readJson(req, Body);

  const articles = body.articles ?? worksheet.articles;
  if (body.articles) {
    for (const a of articles.filter((x) => x.status === "ready")) {
      if (!a.title || a.paragraphs.filter(Boolean).length === 0) {
        throw new HttpError(400, `'${a.topic}' 기사의 제목과 본문을 채워 주세요.`);
      }
      if (a.opinionQuestion && a.stances.length < 2) {
        throw new HttpError(400, `'${a.topic}' 기사의 생각 나누기 입장을 2개 이상 입력해 주세요.`);
      }
    }
  }

  const patch: Parameters<ReturnType<typeof getDb>["updateWorksheet"]>[1] = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.articles) patch.articles = body.articles;
  if (body.status === "published" && worksheet.status !== "published") {
    if (!articles.some((a) => a.status === "ready")) {
      throw new HttpError(400, "완성된 기사가 하나 이상 있어야 배포할 수 있어요.");
    }
    patch.status = "published";
    patch.publishedAt = nowIso();
  } else if (body.status === "draft") {
    patch.status = "draft";
  }

  const updated = await getDb().updateWorksheet(worksheetId, patch);
  return Response.json({ worksheet: updated });
});

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const { worksheetId } = await ctx.params;
  await requireTeacherWorksheet(worksheetId);
  await getDb().deleteWorksheet(worksheetId);
  return Response.json({ ok: true });
});
