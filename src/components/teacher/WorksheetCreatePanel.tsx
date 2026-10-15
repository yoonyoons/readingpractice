"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorText, Modal, Spinner } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

/** 이번 주 기사로 학습지를 만든다. 내가 고른 기사는 학습지 편집 화면의 '＋ 기사 추가'로 넣는다 */
export function WorksheetCreatePanel({
  classId,
  gradeLabel,
  weeklyReady,
  weeklyCanBuild,
  weeklyLoaded,
}: {
  classId: string;
  gradeLabel: string;
  /** 불러올 이번 주 기사가 있거나, 데모 모드라 바로 만들 수 있다 */
  weeklyReady: boolean;
  /** 이번 주 기사가 없으면 불러오기를 누를 때 서버가 그 자리에서 만든다 (공용 베타 체험 계정은 제외) */
  weeklyCanBuild: boolean;
  /** 이번 주 기사로 만든 학습지가 이미 있다 */
  weeklyLoaded: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadWeekly() {
    if (weeklyLoaded && !window.confirm("이번 주 기사를 이미 불러왔어요.\n같은 기사로 초안을 하나 더 만들까요?")) return;
    setLoading(true);
    setError("");
    try {
      const r = await apiFetch<{ worksheetId: string }>(`/api/classes/${classId}/weekly`);
      router.push(`/teacher/classes/${classId}/worksheets/${r.worksheetId}`);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Card>
      <h2 className="text-[18px] font-bold">학습지 만들기</h2>
      <div className="mt-4">
        <Button size="lg" className="w-full" onClick={loadWeekly} loading={loading} disabled={!weeklyReady && !weeklyCanBuild}>
          📥 이번 주 기사 불러오기
        </Button>
      </div>

      {!weeklyReady && (
        <p className="mt-2 text-[13px] leading-relaxed text-grey-500">
          {weeklyCanBuild
            ? "이번 주 기사가 아직 준비되지 않았어요. 불러오기를 누르면 지금 만들기 시작해요 (2~3분)."
            : "이번 주 기사를 준비하고 있어요. 조금 뒤에 다시 불러와 주세요."}
        </p>
      )}
      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <Modal open={loading && !weeklyReady && weeklyCanBuild} title="이번 주 기사를 만들고 있어요">
        <div className="flex items-start gap-3">
          <Spinner className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-[15px] font-semibold text-grey-800">지난 7일 뉴스에서 주제를 골라 {gradeLabel} 기사로 쓰는 중</p>
            <p className="mt-1 text-[13px] leading-relaxed text-grey-500">
              뉴스 수집 → 주제 선정 → 기사·어휘·퀴즈 작성 순서로 진행돼요. 2~3분 정도 걸리니 창을 닫지 말고 기다려 주세요.
            </p>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
