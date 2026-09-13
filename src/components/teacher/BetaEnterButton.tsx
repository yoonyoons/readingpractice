"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

export function BetaEnterButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function enter() {
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/teacher/demo");
      router.replace("/teacher");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button size="lg" className="w-full" onClick={enter} loading={loading}>
        체험용 반으로 들어가기
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
