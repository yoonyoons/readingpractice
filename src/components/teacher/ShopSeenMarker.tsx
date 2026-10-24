"use client";

import { useEffect } from "react";
import { shopSeenCookie } from "@/lib/shop-rules";

/** 선생님이 상점 페이지를 열면 지금까지의 교환을 이 브라우저에서 '확인함'으로 기억한다 */
export function ShopSeenMarker({ classId, latest }: { classId: string; latest: string | null }) {
  useEffect(() => {
    if (!latest) return;
    document.cookie = `${shopSeenCookie(classId)}=${latest}; path=/teacher; max-age=31536000; samesite=lax`;
  }, [classId, latest]);
  return null;
}
