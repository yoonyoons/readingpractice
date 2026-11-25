import nodemailer, { type Transporter } from "nodemailer";

/**
 * 인증 코드 메일 발송. SMTP_HOST / SMTP_USER / SMTP_PASS 가 있어야 실제로 보낸다.
 * Gmail이면 SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_PASS=앱 비밀번호.
 */

let transport: Transporter | undefined;

export function hasMailer() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

/** 인증 메일을 보내는 주소. 받는 쪽에서 수신 허용 목록에 넣을 수 있게 화면에 보여 준다. */
export function mailSenderAddress() {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "";
  return from.match(/<([^>]+)>/)?.[1]?.trim() || from.trim();
}

export async function sendMail(options: { to: string; subject: string; text: string; html: string }) {
  if (!hasMailer()) throw new Error("메일 발송 설정(SMTP_HOST, SMTP_USER, SMTP_PASS)이 없어요.");
  await transporter().sendMail({
    from: process.env.MAIL_FROM || `"시사 문해력 학습지" <${process.env.SMTP_USER}>`,
    ...options,
  });
}
