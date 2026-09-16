import type { NextRequest } from "next/server";
import { z } from "zod";
import { fetchArticle, pastedArticle } from "@/lib/article-fetch";
import { analyzeArticle } from "@/lib/custom";
import { getDb } from "@/lib/db";
import { isDemoTeacher } from "@/lib/demo-account";
import { isDemoGeneration } from "@/lib/env";
import { buildAllArticles, emptyArticle } from "@/lib/generation";
import { CUSTOM_ARTICLES_PER_WEEK } from "@/lib/grades";
import { HttpError, readJson, route } from "@/lib/http";
import { requireTeacherClass } from "@/lib/session";
import type { Article } from "@/lib/types";
import { newId, nowIso, weekKey } from "@/lib/utils";

export const maxDuration = 300;

const Item = z.object({
  url: z.string().trim().max(2048, "주소가 너무 길어요.").default(""),
  text: z.string().trim().max(30000, "본문은 3만 자까지 붙여넣을 수 있어요.").default(""),
});

const Body = z.object({
  articles: z
    .array(Item)
    .min(1, "기사 주소(URL)를 붙여넣어 주세요.")
    .max(CUSTOM_ARTICLES_PER_WEEK, `기사는 ${CUSTOM_ARTICLES_PER_WEEK}개까지 넣을 수 있어요.`),
});

/** 나만의 학습지: 교사가 붙여넣은 기사 주소(또는 본문) 1~2개로 이 반 학년군에 맞춘 학습지 초안 하나를 만든다 */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/classes/[classId]/custom">) => {
  const { classId } = await ctx.params;
  const { teacher, classRoom } = await requireTeacherClass(classId);
  const { articles: items } = await readJson(req, Body);
  const many = items.length > 1;
  const label = (i: number) => (many ? `${i + 1}번째 기사: ` : "");
  items.forEach((item, i) => {
    if (!item.url && !item.text) throw new HttpError(400, `${label(i)}기사 주소(URL)를 붙여넣어 주세요.`);
  });

  // 주간 한도는 학습지를 지워도 돌아오지 않도록 따로 센다
  const db = getDb();
  const week = weekKey();
  const used = await db.getCustomUsage(classId, week);
  const left = Math.max(0, CUSTOM_ARTICLES_PER_WEEK - used);
  if (items.length > left) {
    throw new HttpError(
      429,
      left === 0
        ? `이번 주에는 나만의 학습지 기사를 ${CUSTOM_ARTICLES_PER_WEEK}편까지 만들 수 있어요. 다음 주 월요일부터 다시 만들 수 있어요.`
        : `이번 주에는 기사를 ${left}편만 더 만들 수 있어요. 주소를 ${left}개만 넣어 주세요.`,
    );
  }

  // 베타 체험 계정·API 키가 없을 때는 AI 비용이 들지 않도록 예시 기사로 만든다
  const demo = isDemoTeacher(teacher) || isDemoGeneration();
  const topics = await Promise.all(
    items.map(async (item, i) => {
      try {
        const fetched = item.text ? pastedArticle(item.text, item.url) : await fetchArticle(item.url);
        if (fetched.text.replace(/\s/g, "").length < 150) {
          throw new HttpError(
            422,
            "기사 본문을 가져오지 못했어요. 유료·로그인 기사이거나 화면을 나중에 불러오는 사이트일 수 있어요. '본문 직접 붙여넣기'로 기사 내용을 넣어 주세요.",
          );
        }
        return await analyzeArticle(fetched, demo);
      } catch (error) {
        // 기사가 두 개면 어느 쪽 문제인지 알 수 있게 앞에 번호를 붙인다
        if (error instanceof HttpError && many) throw new HttpError(error.status, label(i) + error.message);
        throw error;
      }
    }),
  );

  const drafts: Article[] = topics.map((topic) => ({ ...emptyArticle(topic), sourceMode: "url" }));
  const built = await buildAllArticles(drafts, classRoom.gradeLevel, undefined, demo);
  const first = built[0].status === "ready" ? built[0].title : topics[0].name;

  const worksheet = await db.createWorksheet({
    id: newId(),
    classId,
    title: `나만의 학습지 · ${first}${many ? ` 외 ${built.length - 1}편` : ""}`,
    status: "draft",
    articles: built,
    createdAt: nowIso(),
    publishedAt: null,
  });
  await db.addCustomUsage(classId, week, built.length);

  const failed = built.find((a) => a.status === "failed");
  return Response.json({ worksheetId: worksheet.id, error: failed?.error });
});
