import { redirect } from "next/navigation";
import { JoinForm } from "@/components/student/JoinForm";
import { getStudentSession } from "@/lib/session";

export default async function JoinPage(props: PageProps<"/join">) {
  if (await getStudentSession()) redirect("/s");
  // 반 화면의 QR로 들어오면 ?code=반코드 가 붙어 있다
  const { code } = await props.searchParams;
  const initialCode = (typeof code === "string" ? code : "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return <JoinForm initialCode={initialCode} />;
}
