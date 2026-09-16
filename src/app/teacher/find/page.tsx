import Link from "next/link";
import { redirect } from "next/navigation";
import { FindAccountForm } from "@/components/teacher/FindAccountForm";
import { Card } from "@/components/ui";
import { Byline } from "@/components/Byline";
import { getTeacher } from "@/lib/session";

export default async function TeacherFindPage() {
  if (await getTeacher()) redirect("/teacher");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12 md:max-w-md">
      <Link href="/" className="text-[15px] font-semibold text-primary">
        시사 문해력 기르기
      </Link>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">이메일·비밀번호 찾기</h1>
      <p className="mt-2 text-[15px] text-grey-600">가입할 때 쓴 교육청 메일로 계정을 확인하고 비밀번호를 새로 정해요.</p>
      <Card className="mt-8">
        <FindAccountForm />
      </Card>
      <p className="mt-6 text-center text-[14px] text-grey-500">
        <Link href="/teacher/login" className="font-semibold text-primary">
          로그인으로 돌아가기
        </Link>
      </p>
      <p className="mt-6 text-center text-[13px] text-grey-400">
        <Byline />
      </p>
    </main>
  );
}
