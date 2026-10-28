import type { ReactNode } from "react";

const COPY = {
  teacher: {
    eyebrow: "선생님 공간",
    title: ["이번 주 뉴스로", "학습지를 만들고", "결과까지 한눈에"],
    points: [
      { icon: "📰", text: "이번 주 기사 불러오기 → 미리보기·수정 → 배포" },
      { icon: "🔑", text: "반 코드·QR로 학생이 바로 입장" },
      { icon: "📊", text: "반 결과 분석표와 학생별 AI 의견" },
    ],
  },
  student: {
    eyebrow: "학생 입장",
    title: ["이번 주 뉴스로", "어휘력과 문해력을", "키워 볼까요?"],
    points: [
      { icon: "📰", text: "이번 주 주요 뉴스를 내 학년 수준으로 읽기" },
      { icon: "🧩", text: "어휘 퀴즈로 낱말 익히기" },
      { icon: "📝", text: "스스로 요약하고 생각 나누기" },
    ],
  },
};

/**
 * 로그인·회원가입·반 입장처럼 폼 하나만 있는 화면의 틀.
 * 넓은 화면(lg 이상)에서는 왼쪽에 서비스 소개 패널, 오른쪽에 폼을 두어 화면을 채우고, 그보다 좁으면 폼만 보인다.
 */
export function AuthLayout({ role = "teacher", children }: { role?: keyof typeof COPY; children: ReactNode }) {
  const copy = COPY[role];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="hidden flex-col justify-center bg-primary px-12 py-16 text-white lg:flex xl:px-20">
        <div className="ml-auto w-full max-w-lg">
          <p className="text-[16px] font-semibold text-white/80">시사 문해력 기르기 학습지 · {copy.eyebrow}</p>
          <h2 className="mt-4 text-[40px] font-bold leading-[1.3] tracking-tight xl:text-[44px]">
            {copy.title.map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </h2>
          <ul className="mt-10 space-y-3">
            {copy.points.map((p) => (
              <li key={p.text} className="flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-4 text-[16px] font-medium">
                <span className="text-2xl" aria-hidden>
                  {p.icon}
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="flex flex-col justify-center">{children}</div>
    </div>
  );
}
