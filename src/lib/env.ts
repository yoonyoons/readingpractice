export function hasSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function hasAnthropic() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function claudeModel() {
  return process.env.CLAUDE_MODEL || "claude-opus-5";
}

/** Anthropic API 키가 없으면 예시 기사로 학습지를 만들고 요약은 간단한 규칙으로 채점한다 */
export function isDemoGeneration() {
  return !hasAnthropic();
}
