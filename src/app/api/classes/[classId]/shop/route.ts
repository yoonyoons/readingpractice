import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { ShopItemInputSchema } from "@/lib/schemas";
import { requireTeacherClass } from "@/lib/session";
import { newId, nowIso } from "@/lib/utils";

type Ctx = RouteContext<"/api/classes/[classId]/shop">;

/** 반 하나에 둘 수 있는 상품 수 */
const MAX_ITEMS = 30;

export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const { classId } = await ctx.params;
  await requireTeacherClass(classId);
  const input = await readJson(req, ShopItemInputSchema);
  const db = getDb();
  if ((await db.listShopItems(classId)).length >= MAX_ITEMS) {
    throw new HttpError(400, `상품은 ${MAX_ITEMS}개까지 등록할 수 있어요.`);
  }
  await db.saveShopItem({ id: newId(), classId, ...input, createdAt: nowIso() });
  return Response.json({ ok: true });
});
