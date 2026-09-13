import { redirect } from "next/navigation";
import { JoinForm } from "@/components/student/JoinForm";
import { getStudentSession } from "@/lib/session";

export default async function JoinPage() {
  if (await getStudentSession()) redirect("/s");
  return <JoinForm />;
}
