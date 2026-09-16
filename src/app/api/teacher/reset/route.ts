import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { setTeacherSession } from "@/lib/session";
import { consumeVerificationCode } from "@/lib/teacher-email";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("이메일 형식을 확인해 주세요."),
  code: z.string().trim().regex(/^[0-9]{6}$/, "메일로 받은 인증 코드 6자리를 입력해 주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 해요.").max(100),
});

/** 비밀번호 재설정 2단계: 인증 코드를 확인하고 새 비밀번호로 바꾼 뒤 바로 로그인시킨다 */
export const POST = route(async (req) => {
  const { email, code, password } = await readJson(req, Body);
  const db = getDb();
  const teacher = await db.getTeacherByEmail(email);
  if (!teacher) throw new HttpError(404, "이 주소로 가입한 기록이 없어요. 주소를 다시 확인해 주세요.");

  await consumeVerificationCode(email, code);
  await db.updateTeacherPassword(teacher.id, await bcrypt.hash(password, 10));
  await setTeacherSession(teacher.id);
  return Response.json({ ok: true });
});
