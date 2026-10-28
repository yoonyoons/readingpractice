"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

const TARGETS = {
  teacher: { api: "/api/teacher/demo", next: "/teacher", label: "🧑‍🏫 선생님으로 체험하기" },
  student: { api: "/api/student/demo", next: "/s", label: "🎒 학생으로 체험하기" },
};

export function BetaEnterButton({
  as = "teacher",
  variant = "primary",
  size = "lg",
  label,
}: {
  as?: keyof typeof TARGETS;
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
      await apiFetch(target.api);
      router.replace(target.next);
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
