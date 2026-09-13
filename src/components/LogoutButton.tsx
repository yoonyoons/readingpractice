"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/client-api";

export function LogoutButton({ role, label = "나가기" }: { role: "student" | "teacher"; label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await apiFetch(`/api/${role}/logout`).catch(() => undefined);
    router.replace(role === "student" ? "/join" : "/teacher/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout} loading={loading}>
      {label}
    </Button>
  );
}
