import { ensureDemoTeacher } from "@/lib/demo-account";
import { route } from "@/lib/http";
import { setTeacherSession } from "@/lib/session";

/** 베타 테스트: 공용 체험 계정으로 로그인 */
export const POST = route(async () => {
  const teacher = await ensureDemoTeacher();
  await setTeacherSession(teacher.id);
  return Response.json({ ok: true });
});
