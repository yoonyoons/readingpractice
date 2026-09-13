"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

export function AuthForm({ mode, requireCode }: { mode: "login" | "signup"; requireCode?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch(`/api/teacher/${mode}`, {
        body: mode === "signup" ? { name, email, password, signupCode } : { email, password },
      });
      router.replace("/teacher");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "signup" && (
        <Field label="이름">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="김선생" autoComplete="name" />
        </Field>
      )}
      <Field label="이메일">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teacher@school.kr"
          autoComplete="email"
        />
      </Field>
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
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        {mode === "login" ? "로그인" : "가입하고 시작하기"}
      </Button>
    </form>
  );
}
