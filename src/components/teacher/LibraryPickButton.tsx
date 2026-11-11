"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

/** 자동 기사를 이 반 학생의 관심 분야 학습에 넣거나 뺀다 */
export function LibraryPickButton({
  classId,
  articleId,
  picked,
  readers,
}: {
  classId: string;
  articleId: string;
  picked: boolean;
  /** 이 기사를 읽기 시작한 이 반 학생 수 */
  readers: number;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (picked) {
      const note = readers > 0 ? `\n이 기사를 읽기 시작한 학생 ${readers}명의 목록에서도 사라져요. 이미 모은 별은 그대로 남아요.` : "";
      if (!window.confirm(`이 기사를 학생 목록에서 뺄까요?${note}`)) return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/classes/${classId}/library`, { body: { articleId, picked: !picked } });
      router.refresh();
    } catch (err) {
      window.alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button variant={picked ? "secondary" : "primary"} size="sm" loading={saving} onClick={toggle}>
      {picked ? "학생 목록에서 빼기" : "＋ 학생에게 추가"}
    </Button>
  );
}
