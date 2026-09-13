"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ErrorText, Field, Input, Modal } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import { GRADE_LIST } from "@/lib/grades";
import type { ClassRoom, GradeLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CreateClassButton({ label = "새 반 만들기", size = "md" }: { label?: string; size?: "md" | "lg" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<GradeLevel>("elem56");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { classRoom } = await apiFetch<{ classRoom: ClassRoom }>("/api/classes", {
        body: { name, gradeLevel: grade },
      });
      router.push(`/teacher/classes/${classRoom.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        + {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="새 반 만들기">
        <form onSubmit={submit} className="space-y-5">
          <Field label="반 이름">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="5학년 3반" autoFocus />
          </Field>
          <div>
            <p className="mb-2 text-[14px] font-medium text-grey-700">학년군</p>
            <div className="grid grid-cols-3 gap-2">
              {GRADE_LIST.map((g) => (
                <button
                  key={g.level}
                  type="button"
                  onClick={() => setGrade(g.level)}
                  className={cn(
                    "h-12 rounded-xl text-[14px] font-semibold transition",
                    grade === g.level ? "bg-primary text-white" : "bg-grey-100 text-grey-600 hover:bg-grey-200",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-grey-500">학년군에 맞춰 기사 길이·어휘·요약 기준이 달라져요.</p>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!name.trim()}>
            만들기
          </Button>
        </form>
      </Modal>
    </>
  );
}
