import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { setStudentSession } from "@/lib/session";
import { newId, nowIso } from "@/lib/utils";

const MAX_FAILS = 5;
const LOCK_MINUTES = 5;

const Body = z.object({
  code: z.string().trim().toUpperCase().length(6, "반 코드 6자리를 입력해 주세요."),
  number: z.coerce.number().int("번호를 확인해 주세요.").min(1, "번호를 확인해 주세요.").max(99, "번호를 확인해 주세요."),
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(20, "이름이 너무 길어요."),
  pin: z.string().regex(/^\d{4}$/, "PIN은 숫자 4자리예요."),
});

/** 선생님 화면의 '최근 접속'용. 열이 아직 없는 DB에서도 입장은 되도록 실패해도 넘어간다 */
async function enter(studentId: string) {
  await getDb()
    .updateStudent(studentId, { lastLoginAt: nowIso() })
    .catch((e) => console.error("최근 접속 시각을 저장하지 못했어요", e));
  await setStudentSession(studentId);
}

const sameName = (a: string, b: string) => a.replace(/\s/g, "") === b.replace(/\s/g, "");

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const db = getDb();
  const classRoom = await db.getClassByCode(body.code);
  if (!classRoom) throw new HttpError(404, "반 코드를 다시 확인해 주세요.");

  const existing = await db.getStudentByNumber(classRoom.id, body.number);

  if (!existing) {
    const student = await db.createStudent({
      id: newId(),
      classId: classRoom.id,
      number: body.number,
      name: body.name,
      pinHash: await bcrypt.hash(body.pin, 10),
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: nowIso(),
    });
    await enter(student.id);
    return Response.json({ ok: true, created: true });
  }

  if (!sameName(existing.name, body.name)) {
    throw new HttpError(400, "이 번호는 다른 이름으로 등록되어 있어요. 번호를 확인하거나 선생님께 말씀드려 주세요.");
  }

  // 선생님이 PIN을 초기화한 경우: 이번에 입력한 PIN을 새 PIN으로 정한다
  if (!existing.pinHash) {
    await db.updateStudent(existing.id, {
      pinHash: await bcrypt.hash(body.pin, 10),
      failedAttempts: 0,
      lockedUntil: null,
    });
    await enter(existing.id);
    return Response.json({ ok: true, created: false, pinReset: true });
  }

  if (existing.lockedUntil && Date.parse(existing.lockedUntil) > Date.now()) {
    throw new HttpError(423, `PIN을 여러 번 틀려서 잠겼어요. ${LOCK_MINUTES}분 뒤에 다시 시도하거나 선생님께 말씀드려 주세요.`);
  }

  if (!(await bcrypt.compare(body.pin, existing.pinHash))) {
    const fails = existing.failedAttempts + 1;
    const locked = fails >= MAX_FAILS;
    await db.updateStudent(existing.id, {
      failedAttempts: locked ? 0 : fails,
      lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
    });
    throw new HttpError(
      401,
      locked
        ? `PIN을 ${MAX_FAILS}번 틀려서 ${LOCK_MINUTES}분 동안 잠겼어요.`
        : `PIN이 맞지 않아요. (${fails}/${MAX_FAILS})`,
    );
  }

  await db.updateStudent(existing.id, { failedAttempts: 0, lockedUntil: null });
  await enter(existing.id);
  return Response.json({ ok: true, created: false });
});
