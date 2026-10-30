import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Byline } from "@/components/Byline";
import { BetaEnter } from "@/components/teacher/BetaEnter";
import { Card } from "@/components/ui";
import { getTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "베타 테스트 · 시사 문해력 기르기 학습지" };

const POINTS = [
  "초등 3~4학년·초등 5~6학년·중학생 중 학년군을 골라 체험할 수 있어요. 학년군마다 체험용 반이 따로 있어요.",
  "이번 주 기사 불러오기 → 미리보기·수정 → 배포까지 선생님 화면을 그대로 써 볼 수 있어요.",
  "'학생으로 체험하기'를 누르면 반 코드나 PIN 없이 고른 학년군 체험용 반의 가상 학생 한 명(무작위)으로 학생 화면(읽기·퀴즈·요약·생각 나누기·별 상점)에 바로 들어가요. 요약 채점은 AI 비용이 들지 않도록 예시 채점으로 보여 줘요.",
  "체험용 반마다 가상 학생 10명과 지난 4주 결과가 들어 있어, 결과 분석표와 학생별 AI 의견(예시)을 바로 볼 수 있어요.",
  "이번 주 기사는 미리 만들어 둔 기사를 그대로 불러오고, 다시 만들기는 AI 비용이 들지 않도록 예시 기사로 만들어요.",
  "체험 계정은 여러 선생님이 함께 쓰는 공용 계정이라, 여기서 만든 내용은 다른 체험자에게도 보여요. 실제 학생 이름은 넣지 마세요.",
];

export default async function TeacherBetaPage() {
  if (await getTeacher()) redirect("/teacher");
  return (
    <AuthLayout>
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12 md:max-w-md lg:max-w-lg">
        <Link href="/" className="text-[15px] font-semibold text-primary">
          ← 처음으로
        </Link>
        <h1 className="mt-2 text-[28px] font-bold tracking-tight">베타 테스트 체험</h1>
        <p className="mt-2 text-[15px] text-grey-600">가입하기 전에 이 사이트의 기능을 먼저 써 볼 수 있어요.</p>
        <Card className="mt-8">
          <ul className="space-y-2.5 text-[14px] leading-relaxed text-grey-700">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <BetaEnter />
        </Card>
        <p className="mt-6 text-center text-[14px] text-grey-500">
          실제 수업에 쓰려면{" "}
          <Link href="/teacher/signup" className="font-semibold text-primary">
            교육청 메일로 회원가입
          </Link>
        </p>
        <p className="mt-6 text-center text-[13px] text-grey-400">
          <Byline />
        </p>
      </main>
    </AuthLayout>
  );
}
