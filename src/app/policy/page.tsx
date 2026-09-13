import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "@/components/ui";

export const metadata: Metadata = { title: "운영 정책 · 시사 문해력 기르기 학습지" };

/*
 * 학교에서 운영할 때는 운영 주체(학교·담당 교사), 문의처, 보관 기간을
 * 학교의 개인정보 처리 방침에 맞게 고쳐 쓰세요.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[18px] font-bold text-grey-900">{title}</h2>
      <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-grey-700">{children}</div>
    </section>
  );
}

export default function PolicyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white px-5 pb-16 pt-6">
      <Link href="/" className="-ml-2 inline-flex rounded-full p-2 text-grey-800 hover:bg-grey-100" aria-label="처음으로">
        <ChevronLeft />
      </Link>
      <h1 className="mt-4 text-[26px] font-bold tracking-tight">운영 정책</h1>
      <p className="mt-2 text-[15px] text-grey-500">개인정보와 AI 이용에 대해 학생·보호자·선생님께 알려 드려요.</p>

      <Section title="1. 어떤 서비스인가요?">
        <p>
          선생님이 반을 만들어 학생들에게 매주 시사 학습지를 내주는 수업용 웹 서비스예요. 학생은 뉴스 기사를 읽고, 어휘
          퀴즈를 풀고, 내용을 요약하고, 자기 생각을 나눠요.
        </p>
      </Section>

      <Section title="2. 어떤 정보를 저장하나요?">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>선생님: 이름, 이메일, 비밀번호(암호화하여 저장)</li>
          <li>학생: 반, 번호, 이름, PIN 4자리(암호화하여 저장)</li>
          <li>학습 기록: 기사를 다 읽은 시각, 퀴즈 답, 요약문과 채점 결과, 생각 나누기 글</li>
        </ul>
        <p>이 정보는 수업 진행과 학습 결과 확인에만 쓰며, 광고나 판매에 쓰지 않아요.</p>
      </Section>

      <Section title="3. AI는 어떻게 쓰이나요?">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            기사, 어휘 퀴즈, 생각 나누기 질문은 Anthropic의 AI(Claude)가 웹 검색으로 뉴스를 조사해 만들어요. 선생님이
            내용을 확인하고 고친 뒤 학생에게 내보내요.
          </li>
          <li>
            학생이 쓴 요약문은 채점과 피드백을 위해 AI에 보내져요. 이때 학생의 이름과 번호는 보내지 않아요.
          </li>
          <li>AI가 만든 내용과 채점은 틀릴 수 있어요. 궁금한 점은 선생님께 물어보세요.</li>
        </ul>
      </Section>

      <Section title="4. 학생 글은 어떻게 보호하나요?">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>전화번호·이메일 같은 개인정보나 바르지 않은 말이 들어간 글은 제출되지 않아요.</li>
          <li>생각 나누기 글은 이름 없이 같은 반 친구들에게만 보여요. 선생님은 알맞지 않은 글을 숨길 수 있어요.</li>
          <li>다른 반 학생이나 학교 밖 사람은 우리 반의 학습 기록을 볼 수 없어요.</li>
        </ul>
      </Section>

      <Section title="5. 정보는 언제 지워지나요?">
        <p>
          선생님이 학생, 학습지, 반을 삭제하면 관련 학습 기록도 함께 지워져요. 학년이 끝나 더 이상 쓰지 않는 반은 선생님이
          삭제해 주세요.
        </p>
      </Section>

      <Section title="6. 보호자께 알려 드려요">
        <p>
          이 서비스는 학교 수업의 하나로, 학교의 개인정보 처리 절차에 따라 운영돼요. 만 14세 미만 학생의 정보 처리에
          필요한 보호자 안내·동의는 학교 안내에 따라 진행돼요.
        </p>
      </Section>

      <Section title="7. 문의">
        <p>서비스 이용이나 개인정보에 관한 문의는 담당 선생님께 해 주세요.</p>
      </Section>
    </main>
  );
}
