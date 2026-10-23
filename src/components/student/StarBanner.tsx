import Link from "next/link";
import { FIELD_ORDER, LIBRARY_FIELDS } from "@/lib/library";
import type { LibraryField } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 학생 홈 위쪽: 관심 분야 학습에서 모은 별과 분야 상자 */
export function StarBanner({
  total,
  byField,
  ready,
}: {
  total: number;
  /** 학습 기록을 저장할 준비가 안 됐으면 상자를 막는다 */
  ready: boolean;
  /** 분야마다 모은 별·모을 수 있는 별·기사 수 */
  byField: Record<LibraryField, { stars: number; max: number; count: number }>;
}) {
  return (
    <section className="mt-3 rounded-3xl bg-white p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-primary">언제든 읽는 관심 분야 학습</p>
          <h2 className="mt-0.5 text-[18px] font-bold text-grey-900 md:text-[20px]">관심 있는 주제를 골라 별을 모아요</h2>
        </div>
        <Link href="/s/explore" className="shrink-0 rounded-2xl bg-[#fff8e1] px-3.5 py-2 text-center" aria-label={`내가 모은 별 ${total}개`}>
          <span className="block text-[12px] font-semibold text-grey-500">내가 모은 별</span>
          <span className="block text-[22px] font-bold leading-tight text-grey-900">
            <span className="text-[#f5b301]">★</span> {total}
          </span>
        </Link>
      </div>
      {!ready && (
        <p className="mt-3 rounded-2xl bg-grey-50 px-4 py-3 text-[14px] text-grey-500">관심 분야 학습을 준비하고 있어요. 곧 열려요!</p>
      )}
      <ul className={cn("mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4", !ready && "pointer-events-none opacity-50")} inert={!ready}>
        {FIELD_ORDER.map((field) => {
          const info = LIBRARY_FIELDS[field];
          const f = byField[field];
          return (
            <li key={field}>
              <Link
                href={`/s/explore?field=${field}`}
                className={cn(
                  "flex h-full flex-col rounded-2xl border border-grey-100 p-3.5 transition hover:border-grey-200 active:scale-[0.98]",
                  f.count === 0 && "opacity-60",
                )}
              >
                <span className="text-[26px] leading-none">{info.emoji}</span>
                <span className="mt-2 text-[15px] font-bold text-grey-900">{info.label}</span>
                <span className="mt-0.5 text-[12px] text-grey-500">{info.description}</span>
                <span className="mt-2 text-[13px] font-semibold text-grey-600">
                  <span className="text-[#f5b301]">★</span> {f.stars}/{f.max}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
