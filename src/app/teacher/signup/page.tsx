import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/teacher/AuthForm";
import { Card } from "@/components/ui";
import { getTeacher } from "@/lib/session";

export default async function TeacherSignupPage() {
  if (await getTeacher()) redirect("/teacher");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12 md:max-w-md">
      <Link href="/" className="text-[15px] font-semibold text-primary">
        시사 문해력 기르기
      </Link>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">선생님 회원가입</h1>
      <p className="mt-2 text-[15px] text-grey-600">가입하면 바로 반을 만들 수 있어요.</p>
      <Card className="mt-8">
        <AuthForm mode="signup" requireCode={Boolean(process.env.TEACHER_SIGNUP_CODE)} />
      </Card>
      <p className="mt-6 text-center text-[14px] text-grey-500">
        이미 계정이 있나요?{" "}
        <Link href="/teacher/login" className="font-semibold text-primary">
          로그인
        </Link>
      </p>
    </main>
  );
}
