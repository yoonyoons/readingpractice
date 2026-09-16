"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
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
