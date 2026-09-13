import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import type { GenerationEvent } from "@/lib/events";
import { buildAllArticles, emptyArticle, pickTopics } from "@/lib/generation";
import { route } from "@/lib/http";
import { requireTeacherClass } from "@/lib/session";
import { newId, nowIso, weekTitle } from "@/lib/utils";

export const maxDuration = 300;

export const POST = route(async (_req: NextRequest, ctx: RouteContext<"/api/classes/[classId]/generate">) => {
  const { classId } = await ctx.params;
  const { classRoom } = await requireTeacherClass(classId);
  const db = getDb();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerationEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        send({ type: "stage", stage: "collect" });
        const topics = await pickTopics(3);

        const worksheet = await db.createWorksheet({
          id: newId(),
          classId,
          title: weekTitle(),
          status: "draft",
          articles: topics.map(emptyArticle),
          createdAt: nowIso(),
          publishedAt: null,
        });
        send({
          type: "topics",
          worksheetId: worksheet.id,
          topics: topics.map((t) => ({ name: t.name, mentionCount: t.mentionCount })),
        });

        const articles = await buildAllArticles(worksheet.articles, classRoom.gradeLevel, (index, article) =>
          send(
            article.status === "ready"
              ? { type: "article", index, status: "ready", title: article.title }
              : { type: "article", index, status: "failed", error: article.error },
          ),
        );

        await db.updateWorksheet(worksheet.id, { articles });
        send({ type: "done", worksheetId: worksheet.id });
      } catch (error) {
        console.error(error);
        send({ type: "error", message: error instanceof Error ? error.message : "학습지를 만들지 못했어요." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
