/** FORCE_DEMO=1 이면 키가 있어도 예시 기사·규칙 채점으로 동작한다 (자동 검사·시연용, 비용 0) */
const forcedDemo = () => process.env.FORCE_DEMO === "1";

/**
 * Supabase 접속 정보. 직접 넣은 SUPABASE_URL/SUPABASE_SECRET_KEY 를 우선 쓰고,
 * 없으면 Vercel의 Supabase 연동이 자동으로 넣는 이름(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)을 쓴다.
 */
export function supabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const rawKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  // 환경변수를 붙여넣을 때 흔히 섞이는 실수를 정리한다.
  // - 앞뒤 공백·줄바꿈
  // - 끝 슬래시나 "/rest/v1" (Supabase 대시보드에 REST 엔드포인트 주소가 함께 보여서 잘못 복사하기 쉽다.
  //   supabase-js가 "/rest/v1"을 스스로 붙이므로, 남아 있으면 경로가 겹쳐 "Invalid path specified in request URL" 오류가 난다)
  const url = rawUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "")
    .replace(/\/+$/, "");
  const key = rawKey.trim();
  return { url, key };
}

export function hasSupabase() {
  const { url, key } = supabaseConfig();
  return Boolean(url && key);
}

export function hasAnthropic() {
  return !forcedDemo() && Boolean(process.env.ANTHROPIC_API_KEY);
}

export function hasBrave() {
  return !forcedDemo() && Boolean(process.env.BRAVE_API_KEY);
}

export function claudeModel() {
  return process.env.CLAUDE_MODEL || "claude-opus-5";
}

/** Brave(뉴스 수집)·Anthropic(기사 작성) 키가 하나라도 없으면 예시 기사로 학습지를 만든다 */
export function isDemoGeneration() {
  return !hasBrave() || !hasAnthropic();
}
