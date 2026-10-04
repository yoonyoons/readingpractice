import type { NextRequest } from "next/server";
import { isDemoTeacher } from "@/lib/demo-account";
import { route } from "@/lib/http";
import { requireTeacherClass } from "@/lib/session";
import { loadWeeklySet } from "@/lib/weekly";

/** 미리 만든 기사가 없으면 그 자리에서 만들므로 기사 작성 시간만큼 기다린다 */
export const maxDuration = 300;

/**
 * 이번 주 기사 불러오기: 서버가 이 반 학년군에 맞춰 미리 만들어 둔 기사를 AI 호출 없이 복사해 초안을 만든다.
 * 아직 없으면(Cron 실패 등) 이 학년군 기사를 먼저 만든다. 공용 베타 체험 계정은 AI 비용이 들지 않도록 만들지 않는다.
 */
export const POST = route(async (_req: NextRequest, ctx: RouteContext<"/api/classes/[classId]/weekly">) => {
  const { classId } = await ctx.params;
  const { teacher, classRoom } = await requireTeacherClass(classId);
  const worksheet = await loadWeeklySet(classRoom, { canBuild: !isDemoTeacher(teacher) });
  return Response.json({ worksheetId: worksheet.id });
});
