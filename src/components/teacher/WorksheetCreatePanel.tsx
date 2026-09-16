"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Modal, Spinner, Textarea } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import { CUSTOM_ARTICLES_PER_WEEK } from "@/lib/grades";

/** 기사 입력 한 줄. paste 는 주소로 본문을 못 가져왔을 때만 열린다 */
interface Row {
  url: string;
  text: string;
  paste: boolean;
}
const emptyRow = (): Row => ({ url: "", text: "", paste: false });

/** 학습지를 만드는 두 길: 이번 주 기사 불러오기 / 기사 주소로 직접 제작 */
export function WorksheetCreatePanel({
  classId,
  gradeLabel,
  weeklyReady,
  weeklyLoaded,
}: {
  classId: string;
  gradeLabel: string;
  /** 불러올 이번 주 기사가 있거나, 데모 모드라 바로 만들 수 있다 */
  weeklyReady: boolean;
  /** 이번 주 기사로 만든 학습지가 이미 있다 */
  weeklyLoaded: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
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

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function submitCustom(e: FormEvent) {
    e.preventDefault();
    setError("");
    const articles = rows.map((row) => ({ url: row.url.trim(), text: row.paste ? row.text.trim() : "" }));
    if (articles.some((a) => !a.url && !a.text)) {
      setError("기사 주소(URL)를 붙여넣어 주세요.");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ worksheetId: string }>(`/api/classes/${classId}/custom`, { body: { articles } });
      router.push(`/teacher/classes/${classId}/worksheets/${r.worksheetId}`);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      // 주소로 본문을 못 가져오면 서버가 붙여넣기를 안내하므로 그 줄에만 본문 칸을 연다.
      // 기사가 두 개면 서버가 "2번째 기사: …"처럼 번호를 붙여 준다
      if (message.includes("본문 직접 붙여넣기")) {
        const index = rows.length > 1 ? Number(message.match(/^([0-9]+)번째 기사/)?.[1] ?? 1) - 1 : 0;
        updateRow(index, { paste: true });
      }
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-[18px] font-bold">학습지 만들기</h2>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button size="lg" onClick={loadWeekly} loading={loading} disabled={!weeklyReady}>
          📥 이번 주 기사 불러오기
        </Button>
        <Button
          size="lg"
          variant={open ? "secondary" : "primary"}
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => !v);
            setError("");
          }}
        >
          ✏️ 나만의 학습지 만들기
        </Button>
      </div>

      {open && (
        <form onSubmit={submitCustom} className="mt-4 space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="space-y-2">
              <div className="flex gap-2">
                <Input
                  compact
                  inputMode="url"
                  autoComplete="off"
                  aria-label={`기사 주소(URL) ${i + 1}`}
                  placeholder="https://www.example.co.kr/news/..."
                  value={row.url}
                  onChange={(e) => updateRow(i, { url: e.target.value })}
                  disabled={busy}
                  autoFocus
                  className="min-w-0 flex-1"
                />
                {i > 0 && (
                  <Button
                    variant="ghost"
                    className="shrink-0 px-3"
                    aria-label={`${i + 1}번째 기사 주소 지우기`}
                    onClick={() => setRows((list) => list.filter((_, j) => j !== i))}
                    disabled={busy}
                  >
                    ✕
                  </Button>
                )}
              </div>
              {row.paste && (
                <Textarea
                  compact
                  rows={7}
                  aria-label={`기사 본문 ${i + 1}`}
                  placeholder="기사 본문을 복사해 붙여넣어 주세요"
                  value={row.text}
                  onChange={(e) => updateRow(i, { text: e.target.value })}
                  disabled={busy}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2">
            {rows.length < CUSTOM_ARTICLES_PER_WEEK && (
              <Button variant="grey" onClick={() => setRows((list) => [...list, emptyRow()])} disabled={busy}>
                ＋ 추가
              </Button>
            )}
            <Button type="submit" className="ml-auto" loading={busy}>
              만들기
            </Button>
          </div>
        </form>
      )}

      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

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
