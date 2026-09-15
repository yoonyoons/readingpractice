import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { requireTeacherClass } from "@/lib/session";

type Ctx = RouteContext<"/api/classes/[classId]">;

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const { classId } = await ctx.params;
  await requireTeacherClass(classId);
  await getDb().deleteClass(classId);
  return Response.json({ ok: true });
});
