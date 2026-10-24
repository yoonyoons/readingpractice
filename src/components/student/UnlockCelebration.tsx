"use client";

import type { CSSProperties } from "react";
import { Button, LinkButton } from "@/components/ui";

/** 별이 터져 나가는 방향 (중심에서 떨어진 거리 px) */
const STARS = [
  [-110, -70],
  [110, -80],
  [-140, 20],
  [140, 30],
  [-70, 110],
  [80, 110],
  [0, -130],
  [-30, 140],
] as const;

/**
 * 관심 분야 학습에서 별 3개를 모았을 때: 자물쇠가 흔들리다 열리고, 별이 터지며, 새로 열린 다음 기사 카드가 튀어나온다.
 * 다음 기사 제목은 잠겨 있는 동안 숨겨 두었다가 여기서 처음 보여 준다.
 */
export function UnlockCelebration({
  next,
  onClose,
}: {
  next: { href: string; keyword: string; title: string };
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="다음 기사가 열렸어요"
      className="unlock-backdrop fixed inset-0 z-50 flex items-center justify-center bg-grey-900/70 px-6"
    >
      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="relative flex h-40 w-40 items-center justify-center">
          <span className="unlock-ray absolute inset-0 rounded-full bg-[radial-gradient(circle,rgb(255_214_92/0.9),transparent_65%)]" />
          {STARS.map(([x, y], i) => (
            <span
              key={i}
              className="unlock-star absolute text-[26px] text-[#ffc83d]"
              style={{ "--x": `${x}px`, "--y": `${y}px`, "--delay": `${(i % 3) * 0.06}s` } as CSSProperties}
            >
              ★
            </span>
          ))}
          <svg viewBox="0 0 64 80" className="unlock-lock relative h-28 w-24 drop-shadow-lg" aria-hidden>
            <path
              className="unlock-shackle"
              d="M16 36V24a16 16 0 0 1 32 0v12"
              fill="none"
              stroke="#d9a400"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <rect x="6" y="34" width="52" height="42" rx="9" fill="#ffc83d" />
            <circle cx="32" cy="52" r="6" fill="#8a6500" />
            <rect x="29" y="54" width="6" height="12" rx="3" fill="#8a6500" />
          </svg>
        </div>

        <div className="unlock-card -mt-10 w-full rounded-3xl bg-white p-6 text-center shadow-xl">
          <p className="text-[14px] font-semibold text-[#c48a00]">★★★ 별 3개 달성!</p>
          <h2 className="mt-1 text-[22px] font-bold text-grey-900">다음 기사가 열렸어요</h2>
          <div className="mt-4 rounded-2xl bg-primary-weak px-4 py-3">
            <span className="text-[17px] font-bold text-primary"># {next.keyword}</span>
            <p className="mt-1 text-[15px] font-semibold leading-snug text-grey-800">{next.title}</p>
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="grey" size="lg" className="flex-1" onClick={onClose}>
              나중에
            </Button>
            <LinkButton href={next.href} size="lg" className="flex-1">
              바로 읽기
            </LinkButton>
          </div>
        </div>
      </div>
    </div>
  );
}
