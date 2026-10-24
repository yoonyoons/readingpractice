"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, ChevronRight } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import type { WorksheetStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import type { WorksheetRowData } from "./WorksheetRow";

export const WORKSHEET_STATUS_BADGE: Record<WorksheetStatus, { label: string; tone: "green" | "grey" | "orange" }> = {
  draft: { label: "초안", tone: "grey" },
  published: { label: "배포 중", tone: "green" },
  ended: { label: "학습 종료", tone: "orange" },
};

/** 반 화면과 학습지 관리 화면의 학습지 목록. 체크한 학습지를 아래 고정 바에서 한꺼번에 학습 종료하거나 삭제한다 */
export function WorksheetList({ classId, rows }: { classId: string; rows: WorksheetRowData[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<null | "end" | "delete">(null);
  const [error, setError] = useState("");

  // 목록이 바뀌면(필터 이동, 삭제 뒤 새로고침) 사라진 학습지는 선택에서 뺀다
  const picked = rows.filter((r) => selected.has(r.id));
  const live = picked.filter((r) => r.status === "published");
  const allChecked = rows.length > 0 && picked.length === rows.length;

  function toggle(id: string) {
    setError("");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setError("");
    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function run(kind: "end" | "delete") {
    const targets = kind === "end" ? live : picked;
    if (targets.length === 0) return;
    const skipped = kind === "end" ? picked.length - live.length : 0;
    const message =
      kind === "end"
        ? `배포 중인 학습지 ${targets.length}개의 학습을 종료할까요?\n학생들은 기사와 자기 기록만 볼 수 있고 더 풀 수 없어요. 학습지 화면에서 다시 배포할 수 있어요.` +
          (skipped > 0 ? `\n(배포 중이 아닌 ${skipped}개는 그대로 둬요.)` : "")
        : `학습지 ${targets.length}개를 삭제할까요?\n학생들의 학습 기록도 함께 사라지고 되돌릴 수 없어요.`;
    if (!window.confirm(message)) return;
    setBusy(kind);
    setError("");
    const results = await Promise.allSettled(
      targets.map((r) =>
        kind === "end"
          ? apiFetch(`/api/worksheets/${r.id}`, { method: "PATCH", body: { status: "ended" } })
          : apiFetch(`/api/worksheets/${r.id}`, { method: "DELETE" }),
      ),
    );
    const failed = results.flatMap((res, i) => (res.status === "rejected" ? [{ id: targets[i].id, reason: res.reason }] : []));
    if (failed.length > 0) {
      setError(`${failed.length}개를 처리하지 못했어요. ${errorMessage(failed[0].reason)}`);
      setSelected(new Set(failed.map((f) => f.id)));
    } else {
      setSelected(new Set());
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <>
      <label className="-mx-3 mt-3 flex cursor-pointer items-center gap-3 px-3 py-1.5 text-[13px] font-semibold text-grey-500">
        <input type="checkbox" checked={allChecked} onChange={toggleAll} className="size-4.5 accent-primary" />
        전체 선택
      </label>
      <ul className="divide-y divide-grey-100">
        {rows.map((w) => {
          const badge = WORKSHEET_STATUS_BADGE[w.status];
          const checked = selected.has(w.id);
          return (
            <li key={w.id} className="-mx-3 flex items-center gap-1">
              <label className="flex cursor-pointer self-stretch items-center py-3.5 pl-3 pr-1" aria-label={`${w.title} 선택`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(w.id)} className="size-4.5 accent-primary" />
              </label>
              <Link
                href={`/teacher/classes/${classId}/worksheets/${w.id}`}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-3.5 pr-3 transition hover:bg-grey-50",
                  checked && "bg-primary-weak/50",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    <span className="truncate text-[16px] font-semibold text-grey-800">{w.title}</span>
                  </div>
                  <p className="mt-1 truncate text-[13px] text-grey-500">
                    {formatDate(w.createdAt)} · {w.topics.join(" · ")}
                  </p>
                </div>
                {w.progress && (
                  <span
                    className={cn(
                      "shrink-0 text-[13px] font-semibold",
                      w.status === "published" ? "text-primary" : "text-grey-500",
                    )}
                  >
                    학습 완료 {w.progress.done}/{w.progress.total}명
                  </span>
                )}
                <ChevronRight className="size-5 shrink-0 text-grey-300" />
              </Link>
            </li>
          );
        })}
      </ul>

      {picked.length > 0 && (
        <>
          {/* 고정 바에 가려지지 않도록 목록 아래에 여백을 둔다 */}
          <div className="h-20" />
          <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="animate-fade-up w-full max-w-2xl rounded-2xl bg-grey-900 px-4 py-3 text-white shadow-lg">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold">{picked.length}개 선택됨</span>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-[13px] font-medium text-grey-400 hover:text-white"
                >
                  선택 해제
                </button>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="grey"
                    onClick={() => run("end")}
                    loading={busy === "end"}
                    disabled={Boolean(busy) || live.length === 0}
                    title={live.length === 0 ? "배포 중인 학습지만 학습을 종료할 수 있어요" : undefined}
                  >
                    학습 종료{live.length > 0 && live.length !== picked.length ? ` (${live.length})` : ""}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => run("delete")}
                    loading={busy === "delete"}
                    disabled={Boolean(busy)}
                  >
                    삭제
                  </Button>
                </div>
              </div>
              {error && <p className="mt-2 text-[13px] font-medium text-red-300">{error}</p>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
