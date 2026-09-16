/** 푸터에 붙이는 제작자 표기. 링크 없이 글자만 둔다 (학생 화면에서 밖으로 나가는 통로를 만들지 않으려고). */
export function Byline({ className }: { className?: string }) {
  return <span className={className}>만든이 @융융쌤</span>;
}
