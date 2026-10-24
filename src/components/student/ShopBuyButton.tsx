"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

/** 상점 상품 카드의 '교환하기'. blocked가 있으면 그 까닭을 버튼에 보여 주고 막는다 */
export function ShopBuyButton({ itemId, label, price, blocked }: { itemId: string; label: string; price: number; blocked: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function buy() {
    if (!window.confirm(`별 ${price}개로 '${label}'을(를) 교환할까요?\n교환하면 되돌릴 수 없어요.`)) return;
    setLoading(true);
    try {
      await apiFetch("/api/student/shop", { body: { itemId } });
      window.alert(`'${label}' 교환 완료! 선생님께 받아 가세요.`);
      router.refresh();
    } catch (e) {
      window.alert(errorMessage(e));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="md" className="mt-3 w-full" variant={blocked ? "grey" : "primary"} disabled={Boolean(blocked)} loading={loading} onClick={buy}>
      {blocked ?? "교환하기"}
    </Button>
  );
}
