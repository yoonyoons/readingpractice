import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { listLibraryFor } from "@/lib/library";
import { requireTeacherClass } from "@/lib/session";

type Ctx = RouteContext<"/api/classes/[classId]/library">;

const SaveSchema = z.object({ articleIds: z.array(z.string().min(1)).max(500) });

/** 선생님이 고르고 순서를 정한 관심 분야 기사 목록을 이 반에 올린다 (목록을 통째로 바꾼다) */
export const PUT = route(async (req: NextRequest, ctx: Ctx) => {
  const { classId } = await ctx.params;
  const { classRoom } = await requireTeacherClass(classId);
  const { articleIds } = await readJson(req, SaveSchema);
  const known = new Set((await listLibraryFor(classRoom.gradeLevel)).map((a) => a.id));
  const ids = [...new Set(articleIds)];
  if (ids.some((id) => !known.has(id))) throw new HttpError(400, "이 반 학년군에 없는 기사가 들어 있어요. 화면을 새로 고친 뒤 다시 올려 주세요.");
  try {
    await getDb().saveLibraryPicks(classId, ids);
  } catch (e) {
    console.error("관심 분야 기사 목록 저장 실패", e);
    throw new HttpError(503, "기사 목록을 저장할 곳이 아직 없어요. 운영 DB에 supabase/schema.sql을 다시 실행해 주세요.");
  }
  return Response.json({ ok: true });
});
