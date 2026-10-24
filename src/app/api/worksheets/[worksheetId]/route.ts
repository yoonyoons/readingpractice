import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { MAX_ARTICLES_PER_WORKSHEET } from "@/lib/grades";
import { ArticleSchema } from "@/lib/schemas";
import { requireTeacherWorksheet } from "@/lib/session";
import { nowIso } from "@/lib/utils";

type Ctx = RouteContext<"/api/worksheets/[worksheetId]">;

const Body = z.object({
  title: z.string().trim().min(1, "학습지 제목을 입력해 주세요.").max(60).optional(),
  articles: z
    .array(ArticleSchema)
    .min(1, "기사가 하나 이상 있어야 해요.")
    .max(MAX_ARTICLES_PER_WORKSHEET, `학습지 하나에는 기사를 ${MAX_ARTICLES_PER_WORKSHEET}개까지 넣을 수 있어요.`)
    .optional(),
  status: z.enum(["draft", "published", "ended"]).optional(),
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
    // 학습 종료했다가 다시 배포하면 처음 배포한 날짜를 그대로 둔다
    if (worksheet.status !== "ended" || !worksheet.publishedAt) patch.publishedAt = nowIso();
  } else if (body.status === "draft") {
    patch.status = "draft";
  } else if (body.status === "ended" && worksheet.status !== "ended") {
    if (worksheet.status !== "published") throw new HttpError(400, "배포 중인 학습지만 학습을 종료할 수 있어요.");
    patch.status = "ended";
  }

  const updated = await getDb()
    .updateWorksheet(worksheetId, patch)
    .catch((e: unknown) => {
      // 운영 DB에 schema.sql을 다시 실행하기 전에는 'ended' 상태를 저장할 수 없다
      if (patch.status === "ended" && String(e).includes("worksheets_status_check")) {
        throw new HttpError(503, "학습 종료 기능을 준비하고 있어요. 관리자가 DB를 업데이트하면 쓸 수 있어요.");
      }
      throw e;
    });
  return Response.json({ worksheet: updated });
});

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const { worksheetId } = await ctx.params;
  await requireTeacherWorksheet(worksheetId);
  await getDb().deleteWorksheet(worksheetId);
  return Response.json({ ok: true });
});
