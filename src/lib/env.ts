export function hasSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function hasAnthropic() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function hasBrave() {
  return Boolean(process.env.BRAVE_API_KEY);
}

export function claudeModel() {
  return process.env.CLAUDE_MODEL || "claude-opus-5";
}

/** Brave(뉴스 수집)·Anthropic(기사 작성) 키가 하나라도 없으면 예시 기사로 학습지를 만든다 */
export function isDemoGeneration() {
  return !hasBrave() || !hasAnthropic();
}
