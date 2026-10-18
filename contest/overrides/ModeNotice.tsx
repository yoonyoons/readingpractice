/** 체험판 안내 (원래 앱의 '데모 모드' 안내 자리) */
export function ModeNotice({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-primary-weak px-4 py-3 text-[14px] leading-relaxed text-[#174a9c] ${className ?? ""}`}>
      <b>공모전 체험판이에요.</b> 화면은 실제 서비스와 같고, 이번 주 기사·요약 채점·기사 만들기·AI 의견은 실제 서버의 AI(Claude)를 불러요.
      로그인·학습 기록은 이 브라우저에만 저장돼요.
    </div>
  );
}
