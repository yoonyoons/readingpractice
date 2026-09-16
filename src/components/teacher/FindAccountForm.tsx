"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

type Step = "email" | "notFound" | "found" | "reset";

/**
 * 계정 찾기.
 * 1) 쓰던 것 같은 이메일을 넣어 가입 여부를 확인하고,
 * 2) 맞으면 그 주소로 인증 코드를 받아 비밀번호를 새로 정한다.
 */
export function FindAccountForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [nameHint, setNameHint] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [devCode, setDevCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function backToEmail() {
    setStep("email");
    setError("");
    setNotice("");
    setCode("");
    setPassword("");
    setDevCode("");
  }

  /** 1단계: 이 주소로 가입돼 있는지 확인 */
  async function checkEmail(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ found: boolean; nameHint?: string }>("/api/teacher/find", { body: { email } });
      setNameHint(res.nameHint ?? "");
      setStep(res.found ? "found" : "notFound");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  /** 2단계: 그 주소로 재설정 인증 코드 보내기 */
  async function sendCode() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ expiresInMinutes: number; devCode?: string }>("/api/teacher/reset/request", {
        body: { email },
      });
      setDevCode(res.devCode ?? "");
      setNotice(`${email} 으로 인증 코드를 보냈어요. ${res.expiresInMinutes}분 안에 입력해 주세요.`);
      setStep("reset");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  /** 3단계: 코드 확인 + 새 비밀번호 저장 */
  async function submitReset(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/teacher/reset", { body: { email, code, password } });
      router.replace("/teacher");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  if (step === "email") {
    return (
      <form onSubmit={checkEmail} className="space-y-4">
        <Field label="쓰시던 것 같은 이메일" hint="가입할 때 쓴 교육청 메일 주소를 넣어 보세요. 가입돼 있는지 확인해 드려요.">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@sen.go.kr"
            autoComplete="email"
            autoFocus
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email.includes("@")}>
          이 주소로 가입돼 있는지 확인하기
        </Button>
      </form>
    );
  }

  if (step === "notFound") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-grey-50 px-4 py-3 text-[14px] leading-relaxed text-grey-600">
          <b className="text-grey-900">{email}</b> 로 가입한 기록이 없어요.
          <br />
          학교 메일을 여러 개 쓰신다면 다른 주소로도 확인해 보세요.
        </div>
        <Button size="lg" className="w-full" onClick={backToEmail}>
          다른 주소로 다시 확인하기
        </Button>
        <p className="text-center text-[14px] text-grey-500">
          아직 계정이 없으신가요?{" "}
          <Link href="/teacher/signup" className="font-semibold text-primary">
            회원가입
          </Link>
        </p>
      </div>
    );
  }

  if (step === "found") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-success-weak px-4 py-3 text-[14px] leading-relaxed text-grey-700">
          <b className="text-success">이 주소로 가입돼 있어요.</b>
          <br />
          {email} · {nameHint} 선생님
        </div>
        <ErrorText>{error}</ErrorText>
        <Button size="lg" className="w-full" loading={loading} onClick={sendCode}>
          비밀번호 재설정 코드 받기
        </Button>
        <Link href="/teacher/login" className="block text-center text-[14px] font-semibold text-primary">
          비밀번호가 기억났어요 · 로그인하기
        </Link>
        <button
          type="button"
          onClick={backToEmail}
          className="w-full text-center text-[13px] text-grey-500 underline-offset-2 hover:underline"
        >
          다른 주소로 확인하기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submitReset} className="space-y-4">
      <div className="rounded-xl bg-grey-50 px-4 py-3 text-[13px] leading-relaxed text-grey-600">{notice}</div>
      {devCode && (
        <p className="rounded-xl bg-warning-weak px-4 py-2 text-[13px] text-[#8a5300]">
          개발 모드: 메일 설정이 없어 인증 코드를 여기에 보여줘요 — <b>{devCode}</b>
        </p>
      )}
      <Field label="인증 코드 6자리">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="123456"
          autoComplete="one-time-code"
          autoFocus
          className="tracking-[0.3em]"
        />
      </Field>
      <Field label="새 비밀번호" hint="8자 이상">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={code.length !== 6 || password.length < 8}>
        비밀번호 바꾸고 시작하기
      </Button>
      <button
        type="button"
        onClick={sendCode}
        disabled={loading}
        className="w-full text-center text-[13px] text-grey-500 underline-offset-2 hover:underline"
      >
        코드를 못 받았나요? 다시 보내기
      </button>
    </form>
  );
}
