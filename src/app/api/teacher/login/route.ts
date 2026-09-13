import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { setTeacherSession } from "@/lib/session";

const Body = z.object({
  email: z.string().trim().toLowerCase().min(1, "이메일을 입력해 주세요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export const POST = route(async (req) => {
  const { email, password } = await readJson(req, Body);
  const teacher = await getDb().getTeacherByEmail(email);
  if (!teacher || !(await bcrypt.compare(password, teacher.passwordHash))) {
    throw new HttpError(401, "이메일 또는 비밀번호가 맞지 않아요.");
  }
  await setTeacherSession(teacher.id);
  return Response.json({ ok: true });
});
