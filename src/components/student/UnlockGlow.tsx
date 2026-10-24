"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 탐험 화면에서 새로 열린 기사 카드를 한 번만 반짝이게 한다.
 * 이미 본 카드는 이 브라우저(localStorage)에 기억해 두고, 저장소를 못 쓰면 반짝이지 않는다.
 */
export function UnlockGlow({ storageKey, id, children }: { storageKey: string; id: string; children: ReactNode }) {
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    try {
      const seen = new Set<string>(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
      if (seen.has(id)) return;
      seen.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...seen]));
      // 저장소에서 읽은 값으로 처음 한 번만 정하는 상태라 effect 안에서 바꾼다
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFresh(true);
    } catch {
      // 사생활 보호 모드 등에서는 효과 없이 보여 준다
    }
  }, [storageKey, id]);

  return (
    <div className={cn("relative flex w-full overflow-hidden rounded-3xl", fresh && "unlock-new")}>
      {fresh && (
        <span className="absolute bottom-4 right-4 z-10 animate-pop rounded-full bg-[#ffc83d] px-2 py-0.5 text-[12px] font-bold text-grey-900">
          🔓 새로 열림
        </span>
      )}
      {children}
    </div>
  );
}
