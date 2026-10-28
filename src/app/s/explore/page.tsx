import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Byline } from "@/components/Byline";
import { UnlockGlow } from "@/components/student/UnlockGlow";
import { Badge, ChevronLeft, EmptyState } from "@/components/ui";
import { FIELD_ORDER, LIBRARY_FIELDS, LIBRARY_WORKSHEET_ID, LICENSE_LABEL, starsOf, studentLibrary } from "@/lib/library";
import { getStudentSession } from "@/lib/session";
import { MAX_STARS, STAR_QUIZ_RATE, STAR_SUMMARY_SCORE } from "@/lib/stars";
import type { LibraryField } from "@/lib/types";
import { cn, latestSummary } from "@/lib/utils";

function Stars({ count }: { count: number }) {
  return (
    <span className="text-[16px] tracking-[0.1em]" aria-label={`별 ${count}개`}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <span key={i} className={i < count ? "text-[#f5b301]" : "text-grey-200"}>
          ★
        </span>
      ))}
    </span>
  );
}

/** 관심 분야 학습: 분야 상자 → 키워드 상자를 눌러 기사를 읽고 별을 모은다 */
export default async function ExplorePage(props: PageProps<"/s/explore">) {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const { student, classRoom } = session;
  const { field: rawField } = await props.searchParams;
  const field: LibraryField = FIELD_ORDER.includes(rawField as LibraryField) ? (rawField as LibraryField) : "space";

  const { subMap, total, ready, chains, unlocked } = await studentLibrary(classRoom.gradeLevel, student.id);
  if (!ready) redirect("/s");
  const list = chains[field];
  const openCount = list.filter((a) => unlocked.has(a.id)).length;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-grey-50 pb-12 md:max-w-3xl md:px-6 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl lg:px-8">
      <div className="bg-white md:mt-6 md:rounded-3xl">
        <header className="flex h-14 items-center px-3 md:px-6">
          <Link href="/s" className="inline-flex items-center gap-1 rounded-full p-2 text-[15px] font-medium text-grey-600 hover:bg-grey-100">
            <ChevronLeft className="size-5" />
            {classRoom.name}
          </Link>
        </header>
        <section className="flex items-end justify-between gap-3 px-5 pb-6 pt-2 md:px-8">
          <div>
            <h1 className="text-[24px] font-bold leading-snug tracking-tight md:text-[28px]">관심 분야 탐험</h1>
            <p className="mt-1 text-[14px] text-grey-500">궁금한 키워드를 눌러 읽고, 퀴즈와 요약으로 별을 모아요.</p>
          </div>
          <div className="shrink-0 rounded-2xl bg-[#fff8e1] px-4 py-2 text-center">
            <span className="block text-[12px] font-semibold text-grey-500">내가 모은 별</span>
            <span className="block text-[24px] font-bold leading-tight">
              <span className="text-[#f5b301]">★</span> {total}
            </span>
          </div>
        </section>
      </div>

      <nav className="mt-3 grid grid-cols-2 gap-2.5 px-5 md:grid-cols-4 md:px-0" aria-label="분야">
        {FIELD_ORDER.map((f) => {
          const info = LIBRARY_FIELDS[f];
          const active = f === field;
          return (
            <Link
              key={f}
              href={`/s/explore?field=${f}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 bg-white px-3.5 py-3 transition",
                active ? "border-primary" : "border-transparent hover:border-grey-200",
              )}
            >
              <span className="text-[26px] leading-none">{info.emoji}</span>
              <span className="min-w-0">
                <span className={cn("block text-[15px] font-bold", active ? "text-primary" : "text-grey-800")}>{info.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <section className="mt-5 px-5 md:px-0">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="text-[17px] font-bold text-grey-800">
            {LIBRARY_FIELDS[field].emoji} {LIBRARY_FIELDS[field].label} 키워드
          </h2>
          {list.length > 0 && (
            <span className="text-[13px] font-semibold text-grey-500">
              🔓 {openCount}/{list.length} 열림
            </span>
          )}
        </div>
        {list.length === 0 ? (
          <div className="rounded-3xl bg-white">
            <EmptyState icon="🔭" title="아직 이 분야 기사가 없어요" description="새 기사가 매주 조금씩 늘어나요. 다른 분야를 먼저 탐험해 보세요!" />
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {list.map((a, i) => {
              if (!unlocked.has(a.id)) {
                // 잠긴 기사는 무엇인지 모두 가린다
                return (
                  <li key={a.id} className="flex">
                    <div
                      aria-label={`${i + 1}번째 기사, 잠김`}
                      className="flex w-full flex-col rounded-3xl border border-dashed border-grey-200 bg-grey-100/60 p-5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-xl bg-grey-200 px-3 py-1.5 text-[16px] font-bold text-grey-500"># ???</span>
                        <span className="text-[22px] leading-none" aria-hidden>
                          🔒
                        </span>
                      </div>
                      <p className="mt-3 text-[16px] font-bold leading-snug text-grey-400">어떤 이야기가 숨어 있을까요?</p>
                      <p className="mt-auto pt-4 text-[13px] font-medium text-grey-500">앞 기사에서 별 3개를 모으면 열려요</p>
                    </div>
                  </li>
                );
              }
              const sub = subMap.get(a.id);
              const stars = starsOf(a, sub);
              const started = Boolean(sub?.readAt);
              const summary = latestSummary(sub);
              return (
                <li key={a.id} className="flex">
                  {/* 둘째 기사부터는 처음 열린 것을 볼 때 한 번 반짝인다 */}
                  <Wrap glow={i > 0} storageKey={`rp-unlocked:${student.id}`} id={a.id}>
                    <Link
                      href={`/s/${LIBRARY_WORKSHEET_ID}/${a.id}`}
                      className="flex w-full flex-col rounded-3xl border border-grey-100 bg-white p-5 transition hover:border-grey-200 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-xl bg-primary-weak px-3 py-1.5 text-[16px] font-bold text-primary"># {a.keyword}</span>
                        <Stars count={stars} />
                      </div>
                      <p className="mt-3 text-[16px] font-bold leading-snug text-grey-900">{a.title}</p>
                      <p className="mt-1 text-[12px] text-grey-400">
                        {a.origin.site} · {LICENSE_LABEL[a.origin.license]}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-4">
                        <Badge tone={summary ? "green" : started ? "orange" : "grey"}>
                          {summary ? `요약 ${Math.max(...sub!.summaries.map((s) => s.feedback.score))}점` : started ? "이어서 하기" : "아직 안 읽었어요"}
                        </Badge>
                      </div>
                    </Link>
                  </Wrap>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-[13px] leading-relaxed text-grey-500">
          ⭐ 별 모으는 법 (기사마다 최대 {MAX_STARS}개): 끝까지 읽고 퀴즈 풀기 ★ · 퀴즈 {STAR_QUIZ_RATE * 100}% 이상 맞히기 ★ · 요약{" "}
          {STAR_SUMMARY_SCORE}점 이상 ★. 퀴즈는 다시 풀 수 있고, 요약을 다시 써서 점수가 오르면 별도 늘어나요. 별 3개를 모으면 그 분야의 다음 기사가 열려요 🔓
        </p>
      </section>

      <p className="mt-10 text-center text-[13px] text-grey-400">
        NASA·NOAA·미국 연방준비제도 등 공공 저작물과 국내 공공기관 자료를 바탕으로 AI(Claude)가 학년에 맞게 다시 쓴 글이에요. 기관의 보증을 뜻하지 않아요 · <Byline />
      </p>
    </main>
  );
}

function Wrap({ glow, storageKey, id, children }: { glow: boolean; storageKey: string; id: string; children: ReactNode }) {
  if (!glow) return children;
  return (
    <UnlockGlow storageKey={storageKey} id={id}>
      {children}
    </UnlockGlow>
  );
}
