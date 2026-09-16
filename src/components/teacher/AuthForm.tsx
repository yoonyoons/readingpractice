"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

interface Props {
  mode: "login" | "signup";
  /** TEACHER_SIGNUP_CODE 가 설정된 경우 */
  requireCode?: boolean;
  /** 가입이 허용되는 메일 도메인 안내 (예: "@sen.go.kr") */
  domainHint?: string;
}

export function AuthForm({ mode, requireCode, domainHint }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "verify">("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /** 가입 1단계: 교육청 메일로 인증 코드 요청 */
  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await apiFetch<{ expiresInMinutes: number; devCode?: string }>("/api/teacher/signup/request", {
        body: { email },
      });
      setDevCode(res.devCode ?? "");
      setNotice(`${email} 으로 인증 코드를 보냈어요. ${res.expiresInMinutes}분 안에 입력해 주세요.`);
      setStep("verify");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch(`/api/teacher/${mode}`, {
        body: mode === "signup" ? { name, email, code, password, signupCode } : { email, password },
      });
      router.replace("/teacher");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  if (mode === "signup" && step === "email") {
    return (
      <form onSubmit={requestCode} className="space-y-4">
        <Field label="교육청 이메일" hint={`${domainHint ?? "교육청 메일"} 주소로만 가입할 수 있어요. 인증 코드를 보내 드려요.`}>
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
          인증 코드 받기
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "signup" ? (
        <>
          <div className="rounded-xl bg-grey-50 px-4 py-3 text-[13px] leading-relaxed text-grey-600">
            {notice}{" "}
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError("");
              }}
              className="font-semibold text-grey-700 underline underline-offset-2"
            >
              이메일 바꾸기
            </button>
          </div>
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
          <Field label="이름">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="김선생" autoComplete="name" />
          </Field>
        </>
      ) : (
        <Field label="이메일 주소">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@sen.go.kr"
            autoComplete="email"
          />
        </Field>
      )}
      <Field label="비밀번호" hint={mode === "signup" ? "8자 이상" : undefined}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </Field>
      {mode === "signup" && requireCode && (
        <Field label="가입 코드" hint="관리자에게 받은 교사 가입 코드를 입력해 주세요.">
          <Input value={signupCode} onChange={(e) => setSignupCode(e.target.value)} />
        </Field>
      )}
      <ErrorText>{error}</ErrorText>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={loading}
        disabled={mode === "signup" && (code.length !== 6 || !name.trim() || password.length < 8)}
      >
        {mode === "login" ? "로그인" : "가입하고 시작하기"}
      </Button>
      {mode === "signup" && (
        <button
          type="button"
          onClick={() => requestCode()}
          disabled={loading}
          className="w-full text-center text-[13px] text-grey-500 underline-offset-2 hover:underline"
        >
          코드를 못 받았나요? 다시 보내기
        </button>
      )}
    </form>
  );
}
