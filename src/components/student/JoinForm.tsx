"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BottomBar, Button, ChevronLeft, ErrorText, Field, Input } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

export function JoinForm() {
  const router = useRouter();
  const [step, setStep] = useState<"code" | "info">("code");
  const [code, setCode] = useState("");
  const [classInfo, setClassInfo] = useState<{ name: string; gradeLabel: string } | null>(null);
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function checkCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      setClassInfo(await apiFetch<{ name: string; gradeLabel: string }>("/api/student/class", { body: { code } }));
      setStep("info");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/student/login", { body: { code, number: Number(number), name, pin } });
      router.replace("/s");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  const back =
    step === "info" ? (
      <button
        type="button"
        onClick={() => {
          setStep("code");
          setError("");
        }}
        className="-ml-2 rounded-full p-2 text-grey-800 hover:bg-grey-100"
        aria-label="뒤로"
      >
        <ChevronLeft />
      </button>
    ) : (
      <Link href="/" className="-ml-2 rounded-full p-2 text-grey-800 hover:bg-grey-100" aria-label="처음으로">
        <ChevronLeft />
      </Link>
    );

  return (
    // 휴대폰: 전체 화면, 태블릿 이상: 가운데 놓인 카드
    <main className="mx-auto min-h-dvh w-full max-w-md bg-white px-5 pb-32 md:my-10 md:min-h-0 md:max-w-lg md:rounded-3xl md:px-10 md:pb-10 md:pt-2 md:shadow-sm">
      <div className="flex h-14 items-center">{back}</div>

      {step === "code" ? (
        // 하단 고정 버튼이 화면 기준으로 붙도록 폼에는 애니메이션(transform)을 걸지 않는다
        <form id="code-form" onSubmit={checkCode} className="pt-4">
          <h1 className="animate-fade-up text-[26px] font-bold leading-snug tracking-tight">
            선생님이 알려 준
            <br />반 코드를 입력해 주세요
          </h1>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="ABC123"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            className="mt-10 w-full border-b-2 border-grey-200 bg-transparent pb-3 text-center font-mono text-[36px] font-bold tracking-[0.3em] text-grey-900 outline-none transition placeholder:text-grey-300 focus:border-primary"
          />
          <div className="mt-4 text-center">
            <ErrorText>{error}</ErrorText>
          </div>
          <div className="mt-10 rounded-2xl bg-grey-50 px-4 py-3.5 text-[13px] leading-relaxed text-grey-600">
            🤖 이 학습지는 <b>AI(Claude)</b>가 뉴스를 조사해 만든 기사와 AI 채점을 사용해요. 선생님이 내용을 확인한 뒤
            내보내요.{" "}
            <Link href="/policy" className="font-semibold text-grey-700 underline underline-offset-2">
              운영 정책 보기
            </Link>
          </div>
          <BottomBar inline>
            <Button type="submit" form="code-form" size="lg" className="w-full" disabled={code.length !== 6} loading={loading}>
              다음
            </Button>
          </BottomBar>
        </form>
      ) : (
        <form id="info-form" onSubmit={login} className="pt-4">
          <p className="animate-fade-up text-[15px] font-semibold text-primary">
            {classInfo?.name} · {classInfo?.gradeLabel}
          </p>
          <h1 className="mt-2 text-[26px] font-bold leading-snug tracking-tight">
            번호와 이름,
            <br />
            PIN을 입력해 주세요
          </h1>
          <div className="mt-8 space-y-5">
            <div className="grid grid-cols-[96px_1fr] gap-3">
              <Field label="번호">
                <Input
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  inputMode="numeric"
                  placeholder="7"
                  autoFocus
                />
              </Field>
              <Field label="이름">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" autoComplete="off" />
              </Field>
            </div>
            <Field label="PIN 숫자 4자리" hint="처음 입장한다면 지금 입력한 숫자가 내 PIN이 돼요. 꼭 기억해 주세요!">
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                type="password"
                inputMode="numeric"
                placeholder="••••"
                className="tracking-[0.5em]"
              />
            </Field>
            <ErrorText>{error}</ErrorText>
          </div>
          <BottomBar inline>
            <Button
              type="submit"
              form="info-form"
              size="lg"
              className="w-full"
              disabled={!number || !name.trim() || pin.length !== 4}
              loading={loading}
            >
              입장하기
            </Button>
          </BottomBar>
        </form>
      )}
    </main>
  );
}
