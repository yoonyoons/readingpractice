import { toast } from "../app/toast";

/** 체험판에는 메일 서버가 없으므로 인증 코드를 화면에 보여 준다 */
export function hasMailer() {
  return true;
}

export async function sendMail(options: { to: string; subject: string; text: string; html: string }) {
  const code = options.text.match(/\d{6}/)?.[0] ?? "";
  toast(`체험판이라 메일 대신 여기에 보여 드려요. ${options.to} 인증 코드: ${code}`, 20000);
}
