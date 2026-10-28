import { pickDemoStudent } from "@/lib/demo-account";
import { route } from "@/lib/http";
import { setStudentSession } from "@/lib/session";

/** 베타 테스트: 반 코드·PIN 없이 체험용 반의 가상 학생 중 한 명으로 입장 */
export const POST = route(async () => {
  const student = await pickDemoStudent();
  await setStudentSession(student.id);
  return Response.json({ ok: true });
});
