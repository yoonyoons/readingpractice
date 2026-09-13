import { createHash, randomInt } from "crypto";
import { getDb } from "./db";
import { HttpError } from "./http";
import { hasMailer, sendMail } from "./mailer";
import { nowIso } from "./utils";

/**
 * 교사 가입은 교육청 메일로만 할 수 있다.
 * TEACHER_EMAIL_DOMAINS 에 "sen.go.kr,goe.go.kr"처럼 적으면 그 도메인(과 하위 도메인)만,
 * 비어 있으면 ".go.kr"로 끝나는 모든 도메인을 허용한다.
 */
export const CODE_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;
const RESEND_INTERVAL_MS = 60 * 1000;

function configuredDomains() {
  return (process.env.TEACHER_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function isTeacherEmailAllowed(email: string) {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  const list = configuredDomains();
  if (list.length === 0) return domain.endsWith(".go.kr");
  return list.some((d) => domain === d || domain.endsWith("." + d));
}

/** 가입 화면에 보여줄 허용 도메인 안내 문구 */
export function teacherDomainHint() {
  const list = configuredDomains();
  return list.length ? list.map((d) => "@" + d).join(", ") : "교육청 메일(@…go.kr)";
}

function hashCode(email: string, code: string) {
  return createHash("sha256")
    .update(`${email}:${code}:${process.env.SESSION_SECRET ?? ""}`)
    .digest("hex");
}

/** 인증 코드를 만들어 저장하고 메일로 보낸다. 개발 환경에서 메일 설정이 없으면 코드를 돌려준다. */
export async function requestVerificationCode(email: string): Promise<{ devCode?: string }> {
  if (!isTeacherEmailAllowed(email)) {
    throw new HttpError(403, `${teacherDomainHint()} 주소로만 선생님 계정을 만들 수 있어요.`);
  }
  const db = getDb();
  if (await db.getTeacherByEmail(email)) throw new HttpError(409, "이미 가입된 이메일이에요. 로그인해 주세요.");

  const existing = await db.getVerification(email);
  if (existing && Date.now() - Date.parse(existing.sentAt) < RESEND_INTERVAL_MS) {
    throw new HttpError(429, "인증 코드를 방금 보냈어요. 1분 뒤에 다시 요청해 주세요.");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.saveVerification({
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
    attempts: 0,
    sentAt: nowIso(),
  });

  if (hasMailer()) {
    await sendMail({
      to: email,
      subject: `[시사 문해력 학습지] 선생님 가입 인증 코드 ${code}`,
      text: `선생님 가입 인증 코드는 ${code} 입니다. ${CODE_TTL_MINUTES}분 안에 입력해 주세요.\n본인이 요청한 것이 아니라면 이 메일은 무시하셔도 됩니다.`,
      html: `<div style="font-family:sans-serif;line-height:1.6">
<p>시사 문해력 학습지 선생님 가입 인증 코드입니다.</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
<p>${CODE_TTL_MINUTES}분 안에 입력해 주세요. 본인이 요청한 것이 아니라면 이 메일은 무시하셔도 됩니다.</p>
</div>`,
    });
    return {};
  }

  if (process.env.NODE_ENV === "production") {
    throw new HttpError(500, "메일 발송 설정이 없어 인증 코드를 보낼 수 없어요. 관리자에게 문의해 주세요.");
  }
  // 개발 환경: 메일 대신 콘솔과 응답으로 코드를 알려 준다
  console.warn(`[teacher-email] SMTP 설정이 없어 메일을 보내지 않았어요. ${email} 인증 코드: ${code}`);
  return { devCode: code };
}

/** 입력한 코드를 확인한다. 맞으면 저장된 코드를 지우고, 틀리면 시도 횟수를 늘린다. */
export async function consumeVerificationCode(email: string, code: string) {
  const db = getDb();
  const v = await db.getVerification(email);
  if (!v) throw new HttpError(400, "먼저 인증 코드를 요청해 주세요.");
  if (Date.parse(v.expiresAt) < Date.now()) {
    await db.deleteVerification(email);
    throw new HttpError(400, "인증 코드가 만료됐어요. 다시 요청해 주세요.");
  }
  if (v.attempts >= MAX_CODE_ATTEMPTS) {
    await db.deleteVerification(email);
    throw new HttpError(400, `인증 코드를 ${MAX_CODE_ATTEMPTS}번 틀렸어요. 코드를 다시 요청해 주세요.`);
  }
  if (v.codeHash !== hashCode(email, code)) {
    await db.saveVerification({ ...v, attempts: v.attempts + 1 });
    throw new HttpError(400, `인증 코드가 맞지 않아요. (${v.attempts + 1}/${MAX_CODE_ATTEMPTS})`);
  }
  await db.deleteVerification(email);
}
