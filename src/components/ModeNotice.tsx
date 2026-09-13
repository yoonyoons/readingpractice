import { hasAnthropic, hasSupabase, isDemoGeneration } from "@/lib/env";

export function ModeNotice({ className }: { className?: string }) {
  const demoGeneration = isDemoGeneration();
  const localDb = !hasSupabase();
  if (!demoGeneration && !localDb) return null;

  return (
    <div className={`rounded-2xl bg-warning-weak px-4 py-3 text-[14px] leading-relaxed text-[#8a5300] ${className ?? ""}`}>
      <b>데모 모드로 실행 중이에요.</b>{" "}
      {demoGeneration && "Brave·Anthropic API 키가 없어 예시 기사로 학습지를 만들어요. "}
      {!hasAnthropic() && "요약도 간단한 규칙으로 채점해요. "}
      {localDb && "Supabase 설정이 없어 데이터를 이 컴퓨터의 .data 폴더에 저장해요."}
    </div>
  );
}
