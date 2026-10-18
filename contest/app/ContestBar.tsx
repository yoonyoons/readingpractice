import { useEffect, useState } from "react";
import { getDb } from "@/lib/db";
import { seoulDate } from "@/lib/utils";
import { clearStoredDb } from "../shims/fs";
import { clearCookies } from "../shims/next-headers";
import { DEMO_PIN, demoClass } from "../overrides/demo-account";
import { onQuota, type Quota } from "./contest-api";
import { SITE } from "./site";

/** 화면 구석의 체험판 안내: 남은 AI 횟수, 학생 입장 방법, 처음부터 다시 */
export function ContestBar() {
  const [open, setOpen] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [online, setOnline] = useState(true);
  const [code, setCode] = useState("");
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => onQuota((q, ok) => (setQuota(q), setOnline(ok))), []);
  useEffect(() => {
    if (!open) return;
    void (async () => {
      const c = await demoClass();
      setCode(c?.code ?? "");
      if (c) setNames((await getDb().listStudents(c.id)).slice(0, 3).map((s) => `${s.number}번 ${s.name}`));
    })();
  }, [open]);

  const expired = quota ? seoulDate(new Date()) > quota.lastDay : false;
  const status = !online
    ? "오프라인 · AI 대신 예시"
    : !quota
      ? "실제 서버 연결 중"
      : expired
        ? "AI 체험 기간 종료"
        : `AI 오늘 ${quota.left}/${quota.limit}회`;

  function reset() {
    if (!window.confirm("체험 기록을 모두 지우고 처음부터 다시 할까요?")) return;
    clearStoredDb();
    clearCookies();
    window.location.hash = "/";
    window.location.reload();
  }

  return (
    // 화면 오른쪽 가장자리의 작은 탭: 실제 앱의 위·아래 고정 버튼을 가리지 않는다
    <div className="fixed right-0 top-1/2 z-[90] flex -translate-y-1/2 items-center print:hidden">
      {open && (
        <div className="mr-2 max-h-[80dvh] w-[min(340px,calc(100vw-4rem))] overflow-y-auto rounded-3xl bg-white p-5 text-[14px] leading-relaxed text-grey-700 shadow-[0_8px_30px_rgba(0,0,0,0.18)] animate-fade-up">
          <p className="text-[16px] font-bold text-grey-900">공모전 체험판</p>
          <p className="mt-1">
            실제 서비스 화면 그대로예요. AI 기능은 실제 서버(
            <a href={SITE} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              {SITE.replace(/^https?:\/\//, "")}
            </a>
            )의 Claude를 부르고, 요금 보호를 위해 모든 체험자를 합쳐 하루 {quota?.limit ?? 30}회
            {quota ? `, ${quota.lastDay.slice(5).replace("-", "월 ")}일까지` : ""} 쓸 수 있어요.
          </p>
          <div className="mt-3 rounded-2xl bg-grey-50 p-3">
            <p className="font-semibold text-grey-900">선생님으로</p>
            <p>선생님으로 시작하기 → 가입 없이 체험하기</p>
            <p className="mt-2 font-semibold text-grey-900">학생으로</p>
            <p>
              반 코드 <b className="font-mono text-grey-900">{code || "……"}</b> · 11번부터 아무 번호·이름과 PIN 4자리로 새로 입장
              {names.length > 0 && (
                <span className="text-grey-500">
                  {" "}(가상 학생 {names.join(", ")} 등은 PIN {DEMO_PIN})
                </span>
              )}
            </p>
          </div>
          <p className="mt-3 text-[13px] text-grey-500">기록은 이 브라우저에만 저장돼요.</p>
          <p className="mt-1 text-[13px] font-semibold text-grey-900">{status}</p>
          <button onClick={reset} className="mt-2 text-[13px] font-semibold text-danger underline underline-offset-2">
            처음부터 다시 하기
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title={status}
        className="flex items-center gap-1.5 rounded-l-xl bg-grey-900/85 py-2 pl-2.5 pr-2 text-[12px] font-semibold text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
      >
        <span className={`size-2 rounded-full ${online && !expired && (quota?.left ?? 1) > 0 ? "bg-success" : "bg-warning"}`} />
        {open ? "닫기" : "체험판"}
      </button>
    </div>
  );
}
