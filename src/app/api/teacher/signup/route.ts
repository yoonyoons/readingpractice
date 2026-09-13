import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { setTeacherSession } from "@/lib/session";
import { newId, nowIso } from "@/lib/utils";

const Body = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(30, "이름이 너무 길어요."),
  email: z.string().trim().toLowerCase().email("이메일 형식을 확인해 주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 해요.").max(100),
  signupCode: z.string().optional(),
});

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const requiredCode = process.env.TEACHER_SIGNUP_CODE;
  if (requiredCode && body.signupCode?.trim() !== requiredCode) {
    throw new HttpError(403, "가입 코드가 올바르지 않아요.");
  }

  const db = getDb();
  if (await db.getTeacherByEmail(body.email)) throw new HttpError(409, "이미 가입된 이메일이에요.");

  const teacher = await db.createTeacher({
    id: newId(),
    email: body.email,
    name: body.name,
    passwordHash: await bcrypt.hash(body.password, 10),
    createdAt: nowIso(),
  });
  await setTeacherSession(teacher.id);
  return Response.json({ ok: true });
});
