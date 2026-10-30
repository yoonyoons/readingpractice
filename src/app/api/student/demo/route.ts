import { z } from "zod";
import { pickDemoStudent } from "@/lib/demo-account";
import { readJson, route } from "@/lib/http";
import { setStudentSession } from "@/lib/session";

const Body = z.object({ gradeLevel: z.enum(["elem34", "elem56", "middle"]).default("elem56") });

/** 베타 테스트: 반 코드·PIN 없이 고른 학년군 체험용 반의 가상 학생 중 한 명으로 입장 */
export const POST = route(async (req) => {
  const { gradeLevel } = await readJson(req, Body);
  const student = await pickDemoStudent(gradeLevel);
  await setStudentSession(student.id);
  return Response.json({ ok: true });
});
