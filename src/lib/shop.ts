import { getDb } from "./db";
import { listLibraryArticles, totalStars } from "./library";
import { walletOf } from "./shop-rules";
import type { ShopItem, ShopPurchase } from "./types";

export { blockReason, SHOP_EMOJIS, walletOf, type Wallet } from "./shop-rules";

/*
 * 별 상점. 선생님이 반마다 상품을 등록하고, 학생은 관심 분야 학습에서 모은 별로 교환한다.
 * 모은 별은 줄지 않고(기사 잠금 해제에 쓰인다), 쓸 수 있는 별 = 모은 별 - 교환에 쓴 별이다.
 * 교환하는 순간 별이 빠지고 기록만 남는다(선생님 승인·취소 없음).
 */

/** 학생들의 모은 별 (관심 분야 학습 기록을 아직 저장할 수 없는 DB면 0) */
export async function earnedStars(studentIds: string[]) {
  const [articles, submissions] = await Promise.all([
    listLibraryArticles(),
    getDb()
      .listLibrarySubmissions(studentIds)
      .catch((e) => {
        console.error("관심 분야 학습 기록을 불러오지 못했어요", e);
        return [];
      }),
  ]);
  return totalStars(articles, submissions);
}

/**
 * 반의 상품과 교환 기록. 상점 표(shop_items·shop_purchases)가 아직 없는 DB면 ready가 false이고,
 * 이때는 상점을 '준비 중'으로 보여 준다.
 */
export async function loadShop(classId: string) {
  const db = getDb();
  try {
    const [items, purchases] = await Promise.all([db.listShopItems(classId), db.listShopPurchases(classId)]);
    return { ready: true, items, purchases };
  } catch (e) {
    console.error("별 상점을 불러오지 못했어요 (supabase/schema.sql을 실행했는지 확인)", e);
    return { ready: false, items: [] as ShopItem[], purchases: [] as ShopPurchase[] };
  }
}

/** 학생 id → 지갑 (선생님 화면용) */
export function classWallets(studentIds: string[], earned: Map<string, number>, purchases: ShopPurchase[]) {
  return new Map(
    studentIds.map((id) => [id, walletOf(earned.get(id) ?? 0, purchases.filter((p) => p.studentId === id))]),
  );
}
