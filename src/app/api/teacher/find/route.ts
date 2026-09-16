import { z } from "zod";
import { getDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { isDemoTeacher } from "@/lib/demo-account";
import { isTeacherEmailAllowed } from "@/lib/teacher-email";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("이메일 형식을 확인해 주세요."),
});

/** 이메일 찾기: 입력한 주소로 가입돼 있는지만 알려 준다. 이름은 가려서 본인 확인만 돕는다. */
export const POST = route(async (req) => {
  const { email } = await readJson(req, Body);
  if (!isTeacherEmailAllowed(email)) {
    return Response.json({ found: false });
  }
  const teacher = await getDb().getTeacherByEmail(email);
  if (!teacher || isDemoTeacher(teacher)) return Response.json({ found: false });
  return Response.json({ found: true, nameHint: maskName(teacher.name) });
});

/** "김선생" -> "김○생", "김" -> "김○" */
function maskName(name: string) {
  const chars = [...name];
  if (chars.length <= 1) return name + "○";
  return chars.map((c, i) => (i === 0 || i === chars.length - 1 ? c : "○")).join("");
}
