import Link from "next/link";
import { redirect } from "next/navigation";
import { Byline } from "@/components/Byline";
import { BetaEnterButton } from "@/components/teacher/BetaEnterButton";
import { Card } from "@/components/ui";
import { getTeacher } from "@/lib/session";

/** src/app/teacher/beta/page.tsx 의 체험판: 안내 문구만 체험판에 맞게 바꿨다 */
const POINTS = [
  "이번 주 기사 불러오기 → 미리보기·수정 → 배포까지 선생님 화면을 그대로 써 볼 수 있어요.",
  "체험용 반에는 가상 학생 24명의 지난 3주 학습 기록이 들어 있어 결과 분석표와 AI 의견을 바로 볼 수 있어요.",
  "이번 주 기사·요약 채점·AI 의견은 실제 서버의 AI(Claude)로 만들어요. 요금 보호를 위해 모든 체험자를 합쳐 하루 사용 횟수가 정해져 있어요.",
  "체험용 반의 반 코드로 학생 화면(읽기·퀴즈·요약·생각 나누기)도 함께 체험할 수 있어요. 기록은 이 브라우저에만 저장돼요.",
];

export default async function TeacherBetaPage() {
  if (await getTeacher()) redirect("/teacher");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12 md:max-w-md">
      <Link href="/teacher/login" className="text-[15px] font-semibold text-primary">
        ← 선생님 로그인
      </Link>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">체험하기</h1>
      <p className="mt-2 text-[15px] text-grey-600">가입 없이 이 사이트의 기능을 써 볼 수 있어요.</p>
      <Card className="mt-8">
        <ul className="space-y-2.5 text-[14px] leading-relaxed text-grey-700">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-primary">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <BetaEnterButton />
        </div>
      </Card>
      <p className="mt-6 text-center text-[13px] text-grey-400">
        <Byline />
      </p>
    </main>
  );
}
