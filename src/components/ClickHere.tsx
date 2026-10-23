import Link from "next/link";
import type { ReactNode } from "react";

const INK = "#191f28";

/**
 * 눌러 보라고 눈에 띄게 만든 버튼: 테두리 버튼을 마우스 화살표가 딸깍 누르고,
 * 버튼이 숨쉬듯 커졌다 작아지며 반짝임이 지나가고 별이 깜빡인다. (움직임은 globals.css의 click-* 키프레임)
 */
export function ClickHere({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group relative mt-3 inline-block px-7 pb-3">
      {/* 크기가 살짝 커졌다 작아지는 숨쉬기 + 클릭할 때 눌리는 움직임 */}
      <span className="relative inline-block animate-[click-breathe_1.6s_ease-in-out_infinite]">
        <span className="relative inline-block animate-[click-press_1.4s_ease-in-out_infinite]">
          {/* 살짝 어긋난 하늘색 채우기 */}
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-1.5 translate-y-1 rounded-full bg-[#8fd3f0] transition group-hover:bg-[#6cc4ea]"
          />
          {/* 글자 뒤로 지나가는 반짝임 */}
          <span aria-hidden className="pointer-events-none absolute inset-[3px] overflow-hidden rounded-full">
            <span className="absolute inset-y-0 -left-1/3 w-1/4 skew-x-[-20deg] animate-[click-shine_2.4s_ease-in-out_infinite] bg-white/70 blur-[2px]" />
          </span>
          <span className="relative block rounded-full border-[3px] border-grey-900 px-7 py-2.5 text-[20px] font-extrabold tracking-tight text-grey-900 md:px-9 md:py-3 md:text-[24px]">
            {children}
          </span>
        </span>
        {/* 깜빡이는 별 */}
        <span
          aria-hidden
          className="absolute left-3 top-[-6px] animate-[click-star_1.6s_ease-in-out_infinite] text-[18px] text-warning"
        >
          ✦
        </span>
        <span
          aria-hidden
          className="absolute left-0 top-6 animate-[click-star_1.6s_ease-in-out_0.8s_infinite] text-[12px] text-primary"
        >
          ✦
        </span>
      </span>
      {/* 마우스 화살표와 클릭 표시 */}
      <svg aria-hidden viewBox="0 0 64 64" className="absolute -right-1 bottom-0 size-14 overflow-visible md:size-16">
        <g
          stroke={INK}
          strokeWidth="3.5"
          strokeLinecap="round"
          className="animate-[click-burst_1.4s_ease-out_infinite]"
        >
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
          className="origin-[16px_18px] animate-[click-cursor_1.4s_ease-in-out_infinite]"
        />
      </svg>
    </Link>
  );
}
