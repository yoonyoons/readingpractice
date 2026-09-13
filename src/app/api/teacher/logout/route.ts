import { route } from "@/lib/http";
import { clearTeacherSession } from "@/lib/session";

export const POST = route(async () => {
  await clearTeacherSession();
  return Response.json({ ok: true });
});
