import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { requireTeacher } from "@/lib/session";
import { makeClassCode, newId, nowIso } from "@/lib/utils";

const Body = z.object({
  name: z.string().trim().min(1, "반 이름을 입력해 주세요.").max(30, "반 이름이 너무 길어요."),
  gradeLevel: z.enum(["elem34", "elem56", "middle"], "학년군을 골라 주세요."),
});

export const POST = route(async (req) => {
  const teacher = await requireTeacher();
  const body = await readJson(req, Body);
  const db = getDb();

  let code = makeClassCode();
  for (let i = 0; i < 5 && (await db.getClassByCode(code)); i++) code = makeClassCode();
  if (await db.getClassByCode(code)) throw new HttpError(500, "반 코드를 만들지 못했어요. 다시 시도해 주세요.");

  const classRoom = await db.createClass({
    id: newId(),
    teacherId: teacher.id,
    name: body.name,
    gradeLevel: body.gradeLevel,
    code,
    autoDraft: false,
    createdAt: nowIso(),
  });
  return Response.json({ classRoom });
});
