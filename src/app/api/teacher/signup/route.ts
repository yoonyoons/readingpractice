import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { setTeacherSession } from "@/lib/session";
import { consumeVerificationCode, isTeacherEmailAllowed, teacherDomainHint } from "@/lib/teacher-email";
import { newId, nowIso } from "@/lib/utils";

const Body = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(30, "이름이 너무 길어요."),
  email: z.string().trim().toLowerCase().email("이메일 형식을 확인해 주세요."),
  code: z.string().trim().regex(/^\d{6}$/, "메일로 받은 인증 코드 6자리를 입력해 주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 해요.").max(100),
  signupCode: z.string().optional(),
});

/** 가입 2단계: 메일로 받은 인증 코드 확인 후 계정 생성 */
export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  if (!isTeacherEmailAllowed(body.email)) {
    throw new HttpError(403, `${teacherDomainHint()} 주소로만 선생님 계정을 만들 수 있어요.`);
  }
  const requiredCode = process.env.TEACHER_SIGNUP_CODE;
  if (requiredCode && body.signupCode?.trim() !== requiredCode) {
    throw new HttpError(403, "가입 코드가 올바르지 않아요.");
  }

  const db = getDb();
  if (await db.getTeacherByEmail(body.email)) throw new HttpError(409, "이미 가입된 이메일이에요.");
  await consumeVerificationCode(body.email, body.code);

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
