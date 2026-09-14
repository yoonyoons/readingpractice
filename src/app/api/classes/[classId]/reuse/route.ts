import type { NextRequest } from "next/server";
import { isDemoTeacher } from "@/lib/demo-account";
import { isDemoGeneration } from "@/lib/env";
import { route } from "@/lib/http";
import { copyReusableWorksheet } from "@/lib/reuse";
import { requireTeacherClass } from "@/lib/session";

/** 이번 주 기사 불러오기: 같은 학년군 다른 반에서 이번 주에 만든 학습지를 AI 호출 없이 복사한다 */
export const POST = route(async (_req: NextRequest, ctx: RouteContext<"/api/classes/[classId]/reuse">) => {
  const { classId } = await ctx.params;
  const { teacher, classRoom } = await requireTeacherClass(classId);
  const worksheet = await copyReusableWorksheet(classRoom, isDemoTeacher(teacher) || isDemoGeneration());
  return Response.json({ worksheetId: worksheet.id });
});
