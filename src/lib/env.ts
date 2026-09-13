/** FORCE_DEMO=1 이면 키가 있어도 예시 기사·규칙 채점으로 동작한다 (자동 검사·시연용, 비용 0) */
const forcedDemo = () => process.env.FORCE_DEMO === "1";

/**
 * Supabase 접속 정보. 직접 넣은 SUPABASE_URL/SUPABASE_SECRET_KEY 를 우선 쓰고,
 * 없으면 Vercel의 Supabase 연동이 자동으로 넣는 이름(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)을 쓴다.
 */
export function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
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
