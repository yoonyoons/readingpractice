"use client";

import { useEffect } from "react";
import { librarySeenCookie } from "@/lib/library-seen";

/** 선생님이 자동 기사 전문 화면을 열면 지금까지의 자동 기사를 이 브라우저에서 '확인함'으로 기억한다 */
export function LibrarySeenMarker({ classId, latest }: { classId: string; latest: string | null }) {
  useEffect(() => {
    if (!latest) return;
    document.cookie = `${librarySeenCookie(classId)}=${latest}; path=/teacher; max-age=31536000; samesite=lax`;
  }, [classId, latest]);
  return null;
}
