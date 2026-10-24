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
