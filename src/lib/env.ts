export function hasSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function hasNaver() {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

export function hasGemini() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiModel() {
  return process.env.GEMINI_MODEL || "gemini-3.5-flash";
}

/** 네이버·Gemini 키가 하나라도 없으면 샘플 기사로 학습지를 만든다 */
export function isDemoGeneration() {
  return !hasNaver() || !hasGemini();
}
