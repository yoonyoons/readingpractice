import type { NextRequest } from "next/server";
import { route } from "@/lib/http";
import { requireTeacherClass } from "@/lib/session";
import { loadWeeklySet } from "@/lib/weekly";

/** 이번 주 기사 불러오기: 서버가 이 반 학년군에 맞춰 미리 만들어 둔 기사를 AI 호출 없이 복사해 초안을 만든다 */
export const POST = route(async (_req: NextRequest, ctx: RouteContext<"/api/classes/[classId]/weekly">) => {
  const { classId } = await ctx.params;
  const { classRoom } = await requireTeacherClass(classId);
  const worksheet = await loadWeeklySet(classRoom);
  return Response.json({ worksheetId: worksheet.id });
});
