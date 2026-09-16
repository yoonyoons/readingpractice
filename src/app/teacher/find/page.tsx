import Link from "next/link";
import { redirect } from "next/navigation";
import { Byline } from "@/components/Byline";
import { FindAccountForm } from "@/components/teacher/FindAccountForm";
import { Card } from "@/components/ui";
import { getTeacher } from "@/lib/session";

/** ?mode=password 면 비밀번호 찾기, 없으면 이메일 찾기 */
export default async function TeacherFindPage(props: PageProps<"/teacher/find">) {
  if (await getTeacher()) redirect("/teacher");
  const query = await props.searchParams;
  const mode = query.mode === "password" ? "password" : "email";

  const copy =
    mode === "password"
      ? { title: "비밀번호 찾기", desc: "가입한 교육청 메일로 인증 코드를 받아 비밀번호를 새로 정해요." }
      : { title: "이메일 찾기", desc: "가입할 때 쓴 교육청 메일이 맞는지 확인해 드려요." };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12 md:max-w-md">
      <Link href="/" className="text-[15px] font-semibold text-primary">
        시사 문해력 기르기
      </Link>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-[15px] text-grey-600">{copy.desc}</p>
      <Card className="mt-8">
        <FindAccountForm mode={mode} />
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
