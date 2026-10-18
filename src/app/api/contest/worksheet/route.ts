import { z } from "zod";
import { fetchArticle, pastedArticle } from "@/lib/article-fetch";
import { contestArticle, withContestQuota } from "@/lib/contest";
import { analyzeArticle } from "@/lib/custom";
import { isDemoGeneration } from "@/lib/env";
import { buildArticle } from "@/lib/generation";
import { HttpError, readJson, route } from "@/lib/http";

export const maxDuration = 300;

const Body = z.object({
  grade: z.enum(["elem34", "elem56", "middle"]),
  url: z.string().trim().max(2048, "주소가 너무 길어요.").default(""),
  text: z.string().trim().max(30000, "본문은 3만 자까지 붙여넣을 수 있어요.").default(""),
});

/** 공모전 체험판: 기사 주소(또는 본문)로 나만의 학습지 기사 하나를 만든다. 저장하지 않고 돌려준다 */
export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  if (!body.url && !body.text) throw new HttpError(400, "기사 주소(URL)를 붙여넣어 주세요.");

  const fetched = body.text ? pastedArticle(body.text, body.url) : await fetchArticle(body.url);
  if (fetched.text.replace(/\s/g, "").length < 150) {
    throw new HttpError(
      422,
      "기사 본문을 가져오지 못했어요. 유료·로그인 기사이거나 화면을 나중에 불러오는 사이트일 수 있어요. '본문 직접 붙여넣기'로 기사 내용을 넣어 주세요.",
    );
  }

  const demo = isDemoGeneration();
  const { result, quota } = await withContestQuota(async () => {
    const topic = await analyzeArticle(fetched, demo);
    const built = await buildArticle(topic, body.grade, demo);
    return contestArticle({ ...built, topic: topic.name, sources: topic.sources });
  });
  return Response.json({ article: result, quota });
});
