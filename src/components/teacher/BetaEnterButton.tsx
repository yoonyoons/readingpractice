"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import { isGradeLevel } from "@/lib/grades";
import type { GradeLevel } from "@/lib/types";

const TARGETS = {
  teacher: { api: "/api/teacher/demo", next: "/teacher", label: "🧑‍🏫 선생님으로 체험하기" },
  student: { api: "/api/student/demo", next: "/s", label: "🎒 학생으로 체험하기" },
};

/** 체험 화면에서 마지막으로 고른 학년군 (이 브라우저에만 저장) */
const GRADE_KEY = "beta-grade";

/** 저장된 학년군 (없으면 null) */
export function readBetaGrade(): GradeLevel | null {
  try {
    const saved = localStorage.getItem(GRADE_KEY);
    if (isGradeLevel(saved)) return saved;
  } catch {}
  return null;
}

export function saveBetaGrade(grade: GradeLevel) {
  try {
    localStorage.setItem(GRADE_KEY, grade);
  } catch {}
}

export function BetaEnterButton({
  as = "teacher",
  grade,
  variant = "primary",
  size = "lg",
  label,
}: {
  as?: keyof typeof TARGETS;
  /** 들어갈 체험용 반의 학년군. 없으면 마지막으로 고른 학년군(처음이면 초등 5~6학년) */
  grade?: GradeLevel;
  variant?: "primary" | "secondary" | "grey" | "ghost";
  size?: "lg" | "md" | "sm";
  label?: string;
}) {
  const router = useRouter();
  const target = TARGETS[as];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function enter() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ next?: string }>(target.api, { body: { gradeLevel: grade ?? readBetaGrade() ?? "elem56" } });
      router.replace(res.next ?? target.next);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button size={size} variant={variant} className="w-full" onClick={enter} loading={loading}>
        {label ?? target.label}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
