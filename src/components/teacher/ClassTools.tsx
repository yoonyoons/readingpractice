"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

/** 반 코드와 입장 QR. qrSvg는 서버에서 만든 `${joinUrl}?code=...` QR 그림(SVG) */
export function ClassCode({ code, joinUrl, qrSvg }: { code: string; joinUrl: string; qrSvg: string }) {
  const [copied, setCopied] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const joinLabel = joinUrl.replace(/^https?:\/\//, "");

  async function copy() {
    await navigator.clipboard.writeText(code).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function print() {
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return;
    win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>반 코드 ${code}</title>
<style>body{font-family:-apple-system,"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif;text-align:center;padding:48px 24px;color:#191f28}
.qr{width:360px;height:360px;margin:32px auto}.qr svg{width:100%;height:100%}
.code{font-family:ui-monospace,Menlo,monospace;font-size:56px;font-weight:700;letter-spacing:.2em;margin:8px 0}
p{font-size:18px;color:#4e5968;line-height:1.6}</style></head><body>
<h1>카메라로 QR을 찍어 입장해요</h1><div class="qr">${qrSvg}</div>
<p>반 코드</p><div class="code">${code}</div><p>또는 <b>${joinLabel}</b> 에서 코드를 입력해요.</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
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

      <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-4 text-grey-800">
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          aria-label="QR 크게 보기"
          className="size-[104px] shrink-0 [&_svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-grey-900">QR로 바로 입장</p>
          <p className="mt-1 break-keep text-[12px] leading-relaxed text-grey-600">
            카메라로 찍으면 반 코드가 자동으로 입력돼요.
          </p>
          <div className="mt-2.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => setEnlarged(true)}
              className="rounded-lg bg-primary-weak px-2.5 py-1.5 text-[12px] font-semibold text-primary transition hover:brightness-95"
            >
              ⛶ 크게 보기
            </button>
            <button
              type="button"
              onClick={print}
              className="rounded-lg bg-grey-100 px-2.5 py-1.5 text-[12px] font-semibold text-grey-700 transition hover:bg-grey-200"
            >
              인쇄
            </button>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-white/85">
        또는 <b className="break-all">{joinLabel}</b> 에서 코드를 입력해요.
      </p>

      {enlarged && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="입장 QR 크게 보기"
          onClick={() => setEnlarged(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6 text-grey-900"
        >
          <p className="text-[24px] font-bold md:text-[32px]">카메라로 QR을 찍어 입장해요</p>
          <div
            className="aspect-square w-[min(70vh,80vw)] [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="font-mono text-[40px] font-bold tracking-[0.2em] md:text-[56px]">{code}</p>
          <p className="text-[15px] text-grey-500">
            {joinLabel} · 아무 곳이나 누르면 닫혀요
          </p>
        </div>
      )}
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
