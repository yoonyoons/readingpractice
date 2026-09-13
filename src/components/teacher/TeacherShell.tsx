import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import type { Teacher } from "@/lib/types";

export function TeacherShell({ teacher, children }: { teacher: Teacher; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-grey-50">
      <header className="sticky top-0 z-40 border-b border-grey-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/teacher" className="flex items-center gap-2.5 text-[17px] font-bold text-grey-900">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-[15px] text-white">📰</span>
            시사 문해력
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-[14px] text-grey-600 sm:inline">{teacher.name} 선생님</span>
            <LogoutButton role="teacher" label="로그아웃" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
