import type { NextRequest } from "next/server";
import { z } from "zod";
import { fetchArticle, pastedArticle } from "@/lib/article-fetch";
import { analyzeArticle } from "@/lib/custom";
import { getDb } from "@/lib/db";
import { isDemoTeacher } from "@/lib/demo-account";
import { isDemoGeneration } from "@/lib/env";
import { buildAllArticles, emptyArticle } from "@/lib/generation";
import { HttpError, readJson, route } from "@/lib/http";
import { requireTeacherClass } from "@/lib/session";
import type { Article } from "@/lib/types";
import { newId, nowIso } from "@/lib/utils";

export const maxDuration = 300;

const Body = z.object({
  url: z.string().trim().max(2048, "주소가 너무 길어요.").default(""),
  text: z.string().trim().max(30000, "본문은 3만 자까지 붙여넣을 수 있어요.").default(""),
});

/** 나만의 학습지: 교사가 붙여넣은 기사 주소(또는 본문)로 이 반 학년군에 맞춘 학습지 초안을 만든다 */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/classes/[classId]/custom">) => {
  const { classId } = await ctx.params;
  const { teacher, classRoom } = await requireTeacherClass(classId);
  const body = await readJson(req, Body);
  if (!body.url && !body.text) throw new HttpError(400, "기사 주소(URL)를 붙여넣어 주세요.");

  // 베타 체험 계정·API 키가 없을 때는 AI 비용이 들지 않도록 예시 기사로 만든다
  const demo = isDemoTeacher(teacher) || isDemoGeneration();
  const fetched = body.text ? pastedArticle(body.text, body.url) : await fetchArticle(body.url);
  if (fetched.text.replace(/\s/g, "").length < 150) {
    throw new HttpError(
      422,
      "기사 본문을 가져오지 못했어요. 유료·로그인 기사이거나 화면을 나중에 불러오는 사이트일 수 있어요. '본문 직접 붙여넣기'로 기사 내용을 넣어 주세요.",
    );
  }

  const topic = await analyzeArticle(fetched, demo);
  const article: Article = { ...emptyArticle(topic), sourceMode: "url" };
  const [built] = await buildAllArticles([article], classRoom.gradeLevel, undefined, demo);

  const worksheet = await getDb().createWorksheet({
    id: newId(),
    classId,
    title: `나만의 학습지 · ${built.status === "ready" ? built.title : topic.name}`,
    status: "draft",
    articles: [built],
    createdAt: nowIso(),
    publishedAt: null,
  });
  return Response.json({ worksheetId: worksheet.id, error: built.status === "failed" ? built.error : undefined });
});
