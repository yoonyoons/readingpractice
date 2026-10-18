/*
 * 체험판의 env: 저장은 이 브라우저(개발용 파일 저장소), 기사 만들기는 예시 기사 경로를 쓰되
 * AI 기능(요약 채점·기사 만들기·AI 의견)은 overrides의 다른 파일이 실제 서버의 공모전 API로 보낸다.
 * hasAnthropic()이 true여야 화면이 '데모 모드' 안내 없이 실제 서비스처럼 보인다.
 */
let aiOn = true;

export function supabaseConfig() {
  return { url: "", key: "" };
}

export function hasSupabase() {
  return false;
}

export function hasAnthropic() {
  return aiOn;
}

export function hasBrave() {
  return false;
}

export function claudeModel() {
  return "claude-sonnet-5-5";
}

export function isDemoGeneration() {
  return true;
}

/**
 * 실제 서버를 부르지 못했을 때 원래 코드의 규칙 기반(데모) 경로로 대신 만든다.
 * 원래 함수들은 hasAnthropic()을 맨 처음에 한 번만 확인하므로, 부르는 순간에만 꺼 두면 된다.
 */
export function withoutAi<T>(run: () => Promise<T>): Promise<T> {
  aiOn = false;
  try {
    return run();
  } finally {
    aiOn = true;
  }
}
