import { z } from "zod";
import { getDb } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { requireStudent } from "@/lib/session";
import { blockReason, earnedStars, walletOf } from "@/lib/shop";
import type { ShopPurchase } from "@/lib/types";
import { newId, nowIso } from "@/lib/utils";

const Body = z.object({ itemId: z.string().min(1) });

/**
 * 별로 상품을 교환한다. 교환하는 순간 별이 빠지고 기록이 남는다.
 * 같은 학생이 버튼을 여러 번 누르거나 여러 학생이 마지막 하나를 동시에 누르는 경우를 막기 위해
 * 기록을 먼저 넣고 별·한도를 다시 센 뒤 수량을 줄이고, 어느 단계든 안 되면 기록을 지운다.
 */
export const POST = route(async (req) => {
  const { itemId } = await readJson(req, Body);
  const { student } = await requireStudent();
  const db = getDb();
  const item = await db.getShopItem(itemId);
  if (!item || item.classId !== student.classId) throw new HttpError(404, "상품을 찾을 수 없어요.");

  const earned = (await earnedStars([student.id])).get(student.id) ?? 0;
  const mineOf = async () => (await db.listShopPurchases(student.classId)).filter((p) => p.studentId === student.id);
  const before = await mineOf();
  const reason = blockReason(item, walletOf(earned, before), before);
  if (reason) throw new HttpError(400, reason === "품절" ? "아쉽지만 품절이에요." : reason);

  const purchase: ShopPurchase = {
    id: newId(),
    classId: student.classId,
    studentId: student.id,
    itemId: item.id,
    itemName: item.name,
    itemEmoji: item.emoji,
    price: item.price,
    createdAt: nowIso(),
  };
  await db.createShopPurchase(purchase);

  const after = await mineOf();
  const overLimit = item.perStudentLimit !== null && after.filter((p) => p.itemId === item.id).length > item.perStudentLimit;
  const spent = after.reduce((sum, p) => sum + p.price, 0);
  if (overLimit || spent > earned) {
    await db.deleteShopPurchase(purchase.id);
    throw new HttpError(409, "교환을 처리하지 못했어요. 다시 한 번 눌러 주세요.");
  }
  if (item.stock !== null && !(await db.takeShopStock(item.id, item.stock))) {
    await db.deleteShopPurchase(purchase.id);
    throw new HttpError(409, "방금 다른 친구가 교환해서 수량이 바뀌었어요. 다시 확인해 주세요.");
  }
  return Response.json({ balance: earned - spent });
});
