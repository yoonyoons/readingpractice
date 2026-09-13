import { z } from "zod";
import { getDb } from "@/lib/db";
import { GRADES } from "@/lib/grades";
import { HttpError, readJson, route } from "@/lib/http";

const Body = z.object({
  code: z.string().trim().toUpperCase().length(6, "반 코드 6자리를 입력해 주세요."),
});

export const POST = route(async (req) => {
  const { code } = await readJson(req, Body);
  const classRoom = await getDb().getClassByCode(code);
  if (!classRoom) throw new HttpError(404, "반 코드를 다시 확인해 주세요.");
  return Response.json({ name: classRoom.name, gradeLabel: GRADES[classRoom.gradeLevel].label });
});
