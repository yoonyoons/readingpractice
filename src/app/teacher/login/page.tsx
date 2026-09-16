import Link from "next/link";
import { redirect } from "next/navigation";
import { Byline } from "@/components/Byline";
import { AuthForm } from "@/components/teacher/AuthForm";
import { Card, LinkButton } from "@/components/ui";
import { getTeacher } from "@/lib/session";

export default async function TeacherLoginPage() {
  if (await getTeacher()) redirect("/teacher");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12 md:max-w-md">
      <Link href="/" className="text-[15px] font-semibold text-primary">
        시사 문해력 기르기
      </Link>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">계정 로그인</h1>
      <p className="mt-2 text-[15px] text-grey-600">반을 만들고 이번 주 학습지를 준비해요.</p>
      <Card className="mt-8">
        <AuthForm mode="login" />
        {/* 찾기는 로그인과 목적이 달라서, 폼 아래에 각각 독립된 버튼으로 둔다 */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <LinkButton href="/teacher/find" variant="grey">
            <span aria-hidden>👤</span> 이메일 찾기
          </LinkButton>
          <LinkButton href="/teacher/find?mode=password" variant="grey">
            <span aria-hidden>🔑</span> 비밀번호 찾기
          </LinkButton>
        </div>
      </Card>
      <p className="mt-6 text-center text-[14px] text-grey-500">
        계정이 없으신가요?{" "}
        <Link href="/teacher/signup" className="font-semibold text-primary">
          회원가입
        </Link>
      </p>
      <p className="mt-3 text-center">
        <Link href="/teacher/beta" className="text-[12px] text-grey-400 underline-offset-2 hover:underline">
          가입 없이 베타 테스트로 기능 체험해 보기
        </Link>
      </p>
      <p className="mt-6 text-center text-[13px] text-grey-400">
        <Byline />
      </p>
    </main>
  );
}
