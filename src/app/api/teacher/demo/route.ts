import { cookies } from "next/headers";
import { z } from "zod";
import { DEMO_CLASS_COOKIE, enterDemoTeacher } from "@/lib/demo-account";
import { readJson, route } from "@/lib/http";
import { setTeacherSession } from "@/lib/session";

const Body = z.object({ gradeLevel: z.enum(["elem34", "elem56", "middle"]).default("elem56") });

/** 베타 테스트: 공용 체험 계정으로 로그인하고, 고른 학년군의 체험용 반으로 들어간다 */
export const POST = route(async (req) => {
  const { gradeLevel } = await readJson(req, Body);
  const { teacher, classRoom } = await enterDemoTeacher(gradeLevel);
  await setTeacherSession(teacher.id);
  (await cookies()).set(DEMO_CLASS_COOKIE, classRoom.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return Response.json({ ok: true, next: `/teacher/classes/${classRoom.id}` });
});
