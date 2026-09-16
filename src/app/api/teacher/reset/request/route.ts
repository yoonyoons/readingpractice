import { z } from "zod";
import { readJson, route } from "@/lib/http";
import { CODE_TTL_MINUTES, requestVerificationCode } from "@/lib/teacher-email";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("이메일 형식을 확인해 주세요."),
});

/** 비밀번호 재설정 1단계: 가입한 교육청 메일로 인증 코드 보내기 */
export const POST = route(async (req) => {
  const { email } = await readJson(req, Body);
  const { devCode } = await requestVerificationCode(email, "reset");
  return Response.json({ ok: true, expiresInMinutes: CODE_TTL_MINUTES, ...(devCode ? { devCode } : {}) });
});
