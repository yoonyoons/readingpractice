import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { requireTeacherClass } from "@/lib/session";

type Ctx = RouteContext<"/api/classes/[classId]">;

const Body = z.object({ autoDraft: z.boolean() });

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const { classId } = await ctx.params;
  await requireTeacherClass(classId);
  const { autoDraft } = await readJson(req, Body);
  const classRoom = await getDb().updateClass(classId, { autoDraft });
  return Response.json({ classRoom });
});

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const { classId } = await ctx.params;
  await requireTeacherClass(classId);
  await getDb().deleteClass(classId);
  return Response.json({ ok: true });
});
