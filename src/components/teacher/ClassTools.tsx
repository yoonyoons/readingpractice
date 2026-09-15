"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

export function ClassCode({ code, joinUrl }: { code: string; joinUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-3xl bg-primary p-6 text-white">
      <p className="text-[14px] font-medium text-white/80">반 코드</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="font-mono text-[34px] font-bold tracking-[0.2em]">{code}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded-xl bg-white/20 px-3.5 py-2 text-[14px] font-semibold transition hover:bg-white/30"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-white/85">
        학생은 <b className="break-all">{joinUrl}</b> 에 들어가 이 코드를 입력해요.
      </p>
    </div>
  );
}

export interface RosterStudent {
  id: string;
  number: number;
  name: string;
  hasPin: boolean;
}

export function StudentRoster({ classId, students }: { classId: string; students: RosterStudent[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(student: RosterStudent, action: "reset" | "delete") {
    const label = `${student.number}번 ${student.name}`;
    const ok = window.confirm(
      action === "reset"
        ? `${label} 학생의 PIN을 초기화할까요?\n학생이 다음에 입장할 때 입력하는 숫자가 새 PIN이 돼요.`
        : `${label} 학생을 삭제할까요?\n이 학생의 학습 기록도 함께 지워져요.`,
    );
    if (!ok) return;
    setBusy(student.id);
    setError("");
    try {
      await apiFetch(
        `/api/classes/${classId}/students/${student.id}`,
        action === "reset" ? { method: "PATCH", body: { action: "reset-pin" } } : { method: "DELETE" },
      );
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (students.length === 0) {
    return (
      <p className="rounded-2xl bg-grey-50 px-4 py-8 text-center text-[14px] leading-relaxed text-grey-500">
        학생이 반 코드로 입장하면
        <br />
        여기에 나타나요.
      </p>
    );
  }

  return (
    <div>
      <ErrorText>{error}</ErrorText>
      <ul className="divide-y divide-grey-100">
        {students.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2.5">
            <span className="w-7 text-right text-[14px] font-medium text-grey-400">{s.number}</span>
            <span className="flex-1 text-[15px] font-semibold text-grey-800">
              {s.name}
              {!s.hasPin && <span className="ml-2 text-[12px] font-medium text-warning">PIN 초기화됨</span>}
            </span>
            <Button variant="ghost" size="sm" onClick={() => act(s, "reset")} disabled={busy === s.id}>
              PIN 초기화
            </Button>
            <Button variant="ghost" size="sm" onClick={() => act(s, "delete")} disabled={busy === s.id} className="text-danger">
              삭제
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AutoDraftToggle({ classId, initial }: { classId: string; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    const next = !on;
    setOn(next);
    setLoading(true);
    setError("");
    try {
      await apiFetch(`/api/classes/${classId}`, { method: "PATCH", body: { autoDraft: next } });
      router.refresh();
    } catch (e) {
      setOn(!next);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[16px] font-bold text-grey-900">주간 초안 자동 준비</p>
          <p className="mt-1 text-[13px] leading-relaxed text-grey-500">
            매주 월요일 아침 이번 주 기사가 준비되면 자동으로 불러와 초안을 만들어 둬요. 검토하고 배포만 하면 돼요.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="주간 초안 자동 준비"
          onClick={toggle}
          disabled={loading}
          className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-grey-300"}`}
        >
          <span
            className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function DeleteClassButton({ classId, name }: { classId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!window.confirm(`'${name}' 반을 삭제할까요?\n학생, 학습지, 학습 기록이 모두 지워지고 되돌릴 수 없어요.`)) return;
    setLoading(true);
    try {
      await apiFetch(`/api/classes/${classId}`, { method: "DELETE" });
      router.push("/teacher");
      router.refresh();
    } catch (e) {
      window.alert(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={remove} loading={loading} className="text-grey-400 hover:text-danger">
      반 삭제
    </Button>
  );
}
