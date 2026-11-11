import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { listLibraryFor } from "@/lib/library";
import { requireTeacherClass } from "@/lib/session";

type Ctx = RouteContext<"/api/classes/[classId]/library">;

const PickSchema = z.object({ articleId: z.string().min(1), picked: z.boolean() });

/** 자동 기사를 이 반 학생의 관심 분야 학습에 넣거나 뺀다 */
export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const { classId } = await ctx.params;
  const { classRoom } = await requireTeacherClass(classId);
  const { articleId, picked } = await readJson(req, PickSchema);
  const article = (await listLibraryFor(classRoom.gradeLevel)).find((a) => a.id === articleId && a.addedBy === "auto");
  if (!article) throw new HttpError(404, "이 반 학년군의 자동 기사를 찾을 수 없어요.");
  try {
    await getDb().setLibraryPick(classId, articleId, picked);
  } catch (e) {
    console.error("관심 분야 기사 고르기 저장 실패", e);
    throw new HttpError(503, "기사를 고른 기록을 저장할 곳이 아직 없어요. 운영 DB에 supabase/schema.sql을 다시 실행해 주세요.");
  }
  return Response.json({ ok: true });
});
