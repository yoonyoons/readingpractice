import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { requireTeacherClass } from "@/lib/session";

export const DELETE = route(async (_req: NextRequest, ctx: RouteContext<"/api/classes/[classId]">) => {
  const { classId } = await ctx.params;
  await requireTeacherClass(classId);
  await getDb().deleteClass(classId);
  return Response.json({ ok: true });
});
