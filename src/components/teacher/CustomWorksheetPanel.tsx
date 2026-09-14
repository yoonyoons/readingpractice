"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Field, Input, Modal, Spinner, Textarea } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

export function CustomWorksheetPanel({ classId, gradeLabel, demo }: { classId: string; gradeLabel: string; demo: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const pasted = pasteMode ? text.trim() : "";
    if (!url.trim() && !pasted) {
      setError(pasteMode ? "기사 주소나 본문을 넣어 주세요." : "기사 주소(URL)를 붙여넣어 주세요.");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ worksheetId: string }>(`/api/classes/${classId}/custom`, {
        body: { url: url.trim(), text: pasted },
      });
      router.push(`/teacher/classes/${classId}/worksheets/${r.worksheetId}`);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      if (message.includes("본문 직접 붙여넣기")) setPasteMode(true);
      setBusy(false);
    }
  }

  return (
    <Card>
      <p className="text-[13px] font-semibold text-primary">우리 반 맞춤</p>
      <h3 className="mt-1 text-[20px] font-bold text-grey-900">나만의 학습지 제작하기</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-grey-600">
        수업에 쓰고 싶은 신문 기사의 주소를 붙여넣으면 AI가 기사를 분석해 <b>{gradeLabel}</b> 수준으로 기사를 다시 쓰고
        어휘·퀴즈·생각 나누기 질문을 만들어요. 1~2분 정도 걸리고, 배포 전에 미리 보고 고칠 수 있어요.
      </p>
      {demo && (
        <p className="mt-2 text-[13px] font-medium text-warning">데모 모드에서는 붙여넣은 기사 대신 예시 기사로 만들어요</p>
      )}

      <form onSubmit={submit} className="mt-5 space-y-3">
        <Field label="기사 주소(URL)">
          <Input
            compact
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.example.co.kr/news/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
          />
        </Field>
        {pasteMode ? (
          <Field label="기사 본문" hint="주소로 본문을 못 가져올 때 기사 내용을 복사해 붙여넣어 주세요. 주소도 함께 넣으면 출처로 표시돼요.">
            <Textarea compact rows={7} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => setPasteMode(true)}
            className="block text-[13px] font-medium text-grey-500 underline underline-offset-2 hover:text-grey-700"
          >
            주소로 안 되면 본문 직접 붙여넣기
          </button>
        )}
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" size="lg" className="w-full sm:w-auto" loading={busy}>
          ✏️ 나만의 학습지 만들기
        </Button>
      </form>

      <Modal open={busy} title="나만의 학습지를 만들고 있어요">
        <div className="flex items-start gap-3">
          <Spinner className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-[15px] font-semibold text-grey-800">기사를 읽고 {gradeLabel} 수준으로 다시 쓰는 중</p>
            <p className="mt-1 text-[13px] leading-relaxed text-grey-500">
              기사 분석 → 기사·어휘·퀴즈 작성 순서로 진행돼요. 1~2분 정도 걸리니 창을 닫지 말고 기다려 주세요.
            </p>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
