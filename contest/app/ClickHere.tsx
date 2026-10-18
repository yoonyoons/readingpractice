import Link from "next/link";
import type { ReactNode } from "react";

const INK = "#191f28";

/** 'CLICK HERE' 버튼 그림처럼: 테두리 버튼 + 오른쪽 아래에서 누르는 마우스 화살표와 반짝이는 클릭 표시 */
export function ClickHere({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group relative mt-3 inline-block px-7 pb-3">
      {/* 크기가 살짝 커졌다 작아지는 숨쉬기 + 클릭할 때 눌리는 움직임 */}
      <span className="relative inline-block animate-[contest-breathe_1.6s_ease-in-out_infinite]">
      <span className="relative inline-block animate-[contest-press_1.4s_ease-in-out_infinite]">
        {/* 살짝 어긋난 하늘색 채우기 */}
        <span aria-hidden className="absolute inset-0 -translate-x-1.5 translate-y-1 rounded-full bg-[#8fd3f0] transition group-hover:bg-[#6cc4ea]" />
        {/* 글자 뒤로 지나가는 반짝임 */}
        <span aria-hidden className="pointer-events-none absolute inset-[3px] overflow-hidden rounded-full">
          <span className="absolute inset-y-0 -left-1/3 w-1/4 skew-x-[-20deg] animate-[contest-shine_2.4s_ease-in-out_infinite] bg-white/70 blur-[2px]" />
        </span>
        <span className="relative block rounded-full border-[3px] border-grey-900 px-7 py-2.5 text-[20px] font-extrabold tracking-tight text-grey-900 md:px-9 md:py-3 md:text-[24px]">
          {children}
        </span>
      </span>
      {/* 깜빡이는 별 */}
      <span aria-hidden className="absolute left-3 top-[-6px] animate-[contest-star_1.6s_ease-in-out_infinite] text-[18px] text-warning">✦</span>
      <span aria-hidden className="absolute left-0 top-6 animate-[contest-star_1.6s_ease-in-out_0.8s_infinite] text-[12px] text-primary">✦</span>
      </span>
      {/* 마우스 화살표와 클릭 표시 */}
      <svg
        aria-hidden
        viewBox="0 0 64 64"
        className="absolute -right-1 bottom-0 size-14 overflow-visible md:size-16"
      >
        <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" className="animate-[contest-burst_1.4s_ease-out_infinite]">
          <line x1="14" y1="4" x2="14" y2="12" />
          <line x1="2" y1="16" x2="10" y2="16" />
          <line x1="5" y1="6" x2="10" y2="11" />
          <line x1="24" y1="6" x2="19" y2="11" />
          <line x1="5" y1="26" x2="10" y2="21" />
        </g>
        <path
          d="M16 18 L50 32 L36 37 L46 52 L39 56 L29 41 L20 50 Z"
          fill="#fff"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinejoin="round"
          className="origin-[16px_18px] animate-[contest-cursor_1.4s_ease-in-out_infinite]"
        />
      </svg>
      <style>
        {"@keyframes contest-press{0%,35%,100%{transform:scale(1)}45%{transform:scale(.95)}60%{transform:scale(1)}}" +
          "@keyframes contest-cursor{0%,100%{transform:translate(6px,6px)}40%{transform:translate(0,0)}45%{transform:translate(0,0) scale(.88)}60%{transform:translate(0,0)}}" +
          "@keyframes contest-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}" +
          "@keyframes contest-shine{0%{transform:translateX(0)}60%,100%{transform:translateX(520%)}}" +
          "@keyframes contest-star{0%,100%{opacity:0;transform:scale(.4) rotate(0)}50%{opacity:1;transform:scale(1.15) rotate(90deg)}}" +
          "@keyframes contest-burst{0%,40%{opacity:0;transform:scale(.6)}50%{opacity:1;transform:scale(1.1)}80%,100%{opacity:0;transform:scale(1.3)}}"}
      </style>
    </Link>
  );
}
