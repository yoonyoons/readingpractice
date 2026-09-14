"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, CheckIcon, ErrorText, Modal, Spinner } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import type { GenerationEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

type TopicRow = { name: string; mentionCount: number; status: "building" | "ready" | "failed"; title?: string; error?: string };
type Stage = "idle" | "collect" | "build" | "done" | "error";

export function GeneratePanel({
  classId,
  gradeLabel,
  demo,
  reusable,
}: {
  classId: string;
  gradeLabel: string;
  demo: boolean;
  /** 이번 주 같은 학년군 다른 반에서 만든 학습지가 있으면 그 기사 제목들 */
  reusable: { titles: string[] } | null;
}) {
  const router = useRouter();
  const [reusing, setReusing] = useState(false);
  const [reuseError, setReuseError] = useState("");
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [worksheetId, setWorksheetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const running = stage === "collect" || stage === "build";

  function handle(event: GenerationEvent) {
    switch (event.type) {
      case "stage":
        setStage("collect");
        break;
      case "topics":
        setWorksheetId(event.worksheetId);
        setTopics(event.topics.map((t) => ({ ...t, status: "building" })));
        setStage("build");
        break;
      case "article":
        setTopics((prev) =>
          prev.map((t, i) => (i === event.index ? { ...t, status: event.status, title: event.title, error: event.error } : t)),
        );
        break;
      case "done":
        setWorksheetId(event.worksheetId);
        setStage("done");
        router.refresh();
        break;
      case "error":
        setError(event.message);
        setStage("error");
        router.refresh();
        break;
    }
  }

  async function reuse() {
    setReusing(true);
    setReuseError("");
    try {
      const r = await apiFetch<{ worksheetId: string }>(`/api/classes/${classId}/reuse`);
      router.push(`/teacher/classes/${classId}/worksheets/${r.worksheetId}`);
    } catch (e) {
      setReuseError(errorMessage(e));
      setReusing(false);
    }
  }

  async function start() {
    setOpen(true);
    setStage("collect");
    setTopics([]);
    setWorksheetId(null);
    setError("");
    let finished = false;

    try {
      const res = await fetch(`/api/classes/${classId}/generate`, { method: "POST" });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "학습지를 만들지 못했어요.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          const event = JSON.parse(line) as GenerationEvent;
          if (event.type === "done" || event.type === "error") finished = true;
          handle(event);
        }
      }
      if (!finished) throw new Error("서버 연결이 끊겼어요. 학습지 목록을 확인하거나 다시 시도해 주세요.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "학습지를 만들지 못했어요.");
      setStage("error");
      router.refresh();
    }
  }

  return (
    <>
      <Card className="bg-linear-to-br from-white to-primary-weak/60">
        <p className="text-[13px] font-semibold text-primary">이번 주 학습지</p>
        <h3 className="mt-1 text-[20px] font-bold text-grey-900">뉴스로 학습지 만들기</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-grey-600">
          Brave 뉴스 검색으로 지난 7일 한국·세계 주요 뉴스를 모아 AI가 주제 2개(정치·날씨 제외)를 고르고{" "}
          <b>{gradeLabel}</b> 수준으로 기사와 퀴즈를 만들어요. 1~3분 정도 걸리고, 배포 전에 미리 보고 고칠 수 있어요.
        </p>
        {demo && (
          <p className="mt-2 text-[13px] font-medium text-warning">Brave·Anthropic API 키가 없어 예시 기사로 만들어요 (데모 모드)</p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="w-full sm:w-auto" onClick={start} disabled={running || reusing}>
            ✨ 학습지 만들기
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={reuse}
            loading={reusing}
            disabled={running || !reusable}
          >
            📥 이번 주 기사 불러오기
          </Button>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-grey-500">
          {reusable ? (
            <>
              이번 주 {gradeLabel} 반에서 만든 기사가 있어요. 불러오면 AI를 다시 부르지 않아 비용 없이 바로 초안이
              만들어져요.
              <b className="mt-1 block text-grey-700">{reusable.titles.map((t) => `「${t}」`).join(" ")}</b>
            </>
          ) : (
            <>
              이번 주 {gradeLabel} 반에서 만든 학습지가 아직 없어요. 한 반에서 만들면 같은 학년군의 다른 반은 비용 없이
              불러올 수 있어요.
            </>
          )}
        </p>
        {reuseError && <ErrorText>{reuseError}</ErrorText>}
      </Card>

      <Modal open={open} onClose={running ? undefined : () => setOpen(false)} title="학습지를 만들고 있어요">
        <ol className="space-y-4">
          <li className="flex items-start gap-3">
            <StatusIcon status={stage === "collect" ? "building" : stage === "error" && topics.length === 0 ? "failed" : "ready"} />
            <div>
              <p className="text-[15px] font-semibold text-grey-800">지난 7일 주요 뉴스 조사하고 주제 고르기</p>
              {stage === "collect" && <p className="text-[13px] text-grey-500">뉴스 수백 건을 모아 사건별로 묶고 있어요</p>}
            </div>
          </li>
          {topics.map((t, i) => (
            <li key={i} className="animate-fade-up flex items-start gap-3">
              <StatusIcon status={t.status} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-grey-800">
                  {i + 1}. {t.name}
                  <span className="ml-1.5 text-[13px] font-normal text-grey-400">출처 {t.mentionCount}곳</span>
                </p>
                <p className={cn("text-[13px]", t.status === "failed" ? "text-danger" : "text-grey-500")}>
                  {t.status === "building" ? "학년 수준에 맞게 기사와 퀴즈를 만드는 중" : t.status === "ready" ? t.title : t.error}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {stage === "error" && <p className="mt-5 rounded-xl bg-danger-weak px-4 py-3 text-[14px] text-danger">{error}</p>}

        <div className="mt-6 flex gap-2">
          {stage === "done" && worksheetId && (
            <Button
              size="lg"
              className="flex-1"
              onClick={() => router.push(`/teacher/classes/${classId}/worksheets/${worksheetId}`)}
            >
              미리보기·수정하러 가기
            </Button>
          )}
          {stage === "error" && (
            <>
              <Button size="lg" variant="grey" className="flex-1" onClick={() => setOpen(false)}>
                닫기
              </Button>
              {worksheetId ? (
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => router.push(`/teacher/classes/${classId}/worksheets/${worksheetId}`)}
                >
                  만든 곳까지 보기
                </Button>
              ) : (
                <Button size="lg" className="flex-1" onClick={start}>
                  다시 시도
                </Button>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

function StatusIcon({ status }: { status: "building" | "ready" | "failed" }) {
  if (status === "building") return <Spinner className="mt-0.5 size-5 shrink-0 text-primary" />;
  if (status === "failed")
    return (
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-[11px] font-bold text-white">
        !
      </span>
    );
  return (
    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
      <CheckIcon className="size-3" />
    </span>
  );
}
