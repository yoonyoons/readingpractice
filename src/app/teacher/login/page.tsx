import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/teacher/AuthForm";
import { Card } from "@/components/ui";
import { getTeacher } from "@/lib/session";

export default async function TeacherLoginPage() {
  if (await getTeacher()) redirect("/teacher");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <Link href="/" className="text-[15px] font-semibold text-primary">
        시사 문해력 기르기
      </Link>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">선생님 로그인</h1>
      <p className="mt-2 text-[15px] text-grey-600">반을 만들고 이번 주 학습지를 준비해요.</p>
      <Card className="mt-8">
        <AuthForm mode="login" />
      </Card>
      <p className="mt-6 text-center text-[14px] text-grey-500">
        처음이신가요?{" "}
        <Link href="/teacher/signup" className="font-semibold text-primary">
          회원가입
        </Link>
      </p>
    </main>
  );
}
