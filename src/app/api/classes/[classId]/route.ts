import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { isDemoTeacher } from "@/lib/demo-account";
import { HttpError, route } from "@/lib/http";
import { requireTeacherClass } from "@/lib/session";

type Ctx = RouteContext<"/api/classes/[classId]">;

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const { classId } = await ctx.params;
  const { teacher } = await requireTeacherClass(classId);
  // 체험 계정은 여러 사람이 함께 쓰므로 반을 지울 수 없다
  if (isDemoTeacher(teacher)) throw new HttpError(403, "체험 계정의 반은 삭제할 수 없어요.");
  await getDb().deleteClass(classId);
  return Response.json({ ok: true });
});
