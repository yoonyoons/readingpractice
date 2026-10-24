/** 별 상점 규칙. 서버·화면(클라이언트 컴포넌트)이 함께 쓰므로 DB를 부르지 않는다 */
import type { ShopItem, ShopPurchase } from "./types";

export const SHOP_EMOJIS = ["🍬", "🍭", "🍫", "🍪", "🥤", "✏️", "🖊️", "📒", "🧽", "📏", "🖍️", "🎟️", "💺", "🎮", "🎁", "⭐"];

export interface Wallet {
  /** 관심 분야 학습에서 모은 별 */
  earned: number;
  /** 교환에 쓴 별 */
  spent: number;
  /** 지금 쓸 수 있는 별 */
  balance: number;
}

export function walletOf(earned: number, purchases: ShopPurchase[]): Wallet {
  const spent = purchases.reduce((sum, p) => sum + p.price, 0);
  return { earned, spent, balance: Math.max(0, earned - spent) };
}

/** 이 학생이 이 상품을 더 교환할 수 없는 까닭. 교환할 수 있으면 null */
export function blockReason(item: ShopItem, wallet: Wallet, mine: ShopPurchase[]) {
  if (item.stock !== null && item.stock <= 0) return "품절";
  if (item.perStudentLimit !== null && mine.filter((p) => p.itemId === item.id).length >= item.perStudentLimit) {
    return "교환 한도를 다 썼어요";
  }
  if (wallet.balance < item.price) return `별 ${item.price - wallet.balance}개가 더 필요해요`;
  return null;
}

/** 반 화면 '별 상점' 🔔 표시용 쿠키 이름. 선생님이 상점 페이지에서 마지막으로 본 교환 시각을 담는다 */
export const shopSeenCookie = (classId: string) => `shop_seen_${classId}`;

/** 선생님이 아직 상점 페이지에서 보지 못한 교환 수 (seen이 없으면 모든 교환) */
export function unseenPurchases(purchases: ShopPurchase[], seen: string | undefined) {
  const since = seen ? Date.parse(seen) : NaN;
  return Number.isNaN(since) ? purchases.length : purchases.filter((p) => Date.parse(p.createdAt) > since).length;
}
