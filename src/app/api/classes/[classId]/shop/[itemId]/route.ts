import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { ShopItemInputSchema } from "@/lib/schemas";
import { requireTeacherClass } from "@/lib/session";

type Ctx = RouteContext<"/api/classes/[classId]/shop/[itemId]">;

async function loadItem(ctx: Ctx) {
  const { classId, itemId } = await ctx.params;
  await requireTeacherClass(classId);
  const item = await getDb().getShopItem(itemId);
  if (!item || item.classId !== classId) throw new HttpError(404, "상품을 찾을 수 없어요.");
  return item;
}

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const item = await loadItem(ctx);
  const input = await readJson(req, ShopItemInputSchema);
  await getDb().saveShopItem({ ...item, ...input });
  return Response.json({ ok: true });
});

/** 상품만 지운다. 이미 교환한 기록은 남는다 */
export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const item = await loadItem(ctx);
  await getDb().deleteShopItem(item.id);
  return Response.json({ ok: true });
});
