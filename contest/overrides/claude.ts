import { HttpError } from "@/lib/http";

/** 체험판은 Claude를 직접 부르지 않는다 (AI 기능은 실제 서버의 공모전 API로 보낸다) */
export function ai(): never {
  throw new HttpError(503, "체험판에서는 AI를 직접 부르지 않아요.");
}

export function toAiError() {
  return null;
}

export async function generateJson(): Promise<never> {
  return ai();
}
