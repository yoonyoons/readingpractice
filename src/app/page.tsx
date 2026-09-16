import Link from "next/link";
import { connection } from "next/server";
import { Byline } from "@/components/Byline";
import { ModeNotice } from "@/components/ModeNotice";
import { ChevronRight } from "@/components/ui";

const STEPS = [
  { icon: "📰", title: "기사 읽기", desc: "이번 주 주요 뉴스를 내 학년 수준으로" },
  { icon: "🧩", title: "어휘 퀴즈", desc: "빈칸 채우기 · 비슷한 말 · 내용 이해" },
  { icon: "📝", title: "스스로 요약", desc: "AI 선생님의 점수와 피드백까지" },
  { icon: "💬", title: "생각 나누기", desc: "내 생각을 쓰고 친구들 생각도 보기" },
];

export default async function Home() {
  await connection();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white px-5 pb-8 pt-12 md:max-w-3xl md:px-10 lg:max-w-5xl lg:justify-center lg:px-12 lg:py-16">
      <ModeNotice className="mb-8" />

      {/* 휴대폰: 세로로 쌓고 입장 버튼을 아래에, 태블릿 가로: 왼쪽 소개·오른쪽 입장 버튼 */}
      <div className="flex flex-1 flex-col lg:grid lg:flex-none lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
        <div>
          <p className="animate-fade-up text-[15px] font-semibold text-primary md:text-[16px]">시사 문해력 기르기 학습지</p>
          <h1 className="animate-fade-up mt-3 text-[30px] font-bold leading-[1.35] tracking-tight text-grey-900 md:text-[38px] lg:text-[42px]">
            이번 주 뉴스로
            <br />
            어휘력과 문해력을
            <br />
            키워 볼까요?
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-grey-600 md:text-[17px]">
            매주 한국과 세계의 주요 뉴스 2개를 읽고, 낱말을 익히고, 내 말로 정리해요.
          </p>

          <ol className="mt-8 space-y-1 md:grid md:grid-cols-2 md:gap-x-6 md:space-y-0">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex items-center gap-4 rounded-2xl px-1 py-2.5 md:py-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-grey-50 text-2xl">
                  {step.icon}
                </span>
                <div>
                  <p className="text-[16px] font-bold text-grey-900">
                    <span className="mr-1.5 text-primary">{i + 1}</span>
                    {step.title}
                  </p>
                  <p className="text-[14px] text-grey-500">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-auto space-y-3 pt-10 lg:mt-0 lg:pt-0">
          <Link
            href="/join"
            className="flex items-center gap-4 rounded-3xl bg-primary p-5 text-white transition hover:bg-primary-hover active:scale-[0.98] lg:p-6"
          >
            <span className="text-3xl">🎒</span>
            <span className="flex-1">
              <span className="block text-[17px] font-bold md:text-[18px]">학생으로 시작하기</span>
              <span className="block text-[14px] text-white/80">선생님이 알려 준 반 코드로 입장해요</span>
            </span>
            <ChevronRight />
          </Link>
          <Link
            href="/teacher"
            className="flex items-center gap-4 rounded-3xl bg-grey-100 p-5 text-grey-900 transition hover:bg-grey-200 active:scale-[0.98] lg:p-6"
          >
            <span className="text-3xl">🧑‍🏫</span>
            <span className="flex-1">
              <span className="block text-[17px] font-bold md:text-[18px]">선생님으로 시작하기</span>
              <span className="block text-[14px] text-grey-500">학습지를 만들고 학생 결과를 확인해요</span>
            </span>
            <ChevronRight className="size-5 text-grey-400" />
          </Link>
          <p className="pt-2 text-center text-[13px] leading-relaxed text-grey-400">
            기사·퀴즈·채점에 AI(Claude)를 사용해요 ·{" "}
            <Link href="/policy" className="underline underline-offset-2">
              운영 정책
            </Link>{" "}
            · <Byline />
          </p>
        </div>
      </div>
    </main>
  );
}
