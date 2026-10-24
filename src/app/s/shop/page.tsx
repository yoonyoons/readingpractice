import Link from "next/link";
import { redirect } from "next/navigation";
import { Byline } from "@/components/Byline";
import { ShopBuyButton } from "@/components/student/ShopBuyButton";
import { ChevronLeft, EmptyState } from "@/components/ui";
import { hasShop } from "@/lib/env";
import { getStudentSession } from "@/lib/session";
import { blockReason, earnedStars, loadShop, walletOf } from "@/lib/shop";
import { formatDateTime } from "@/lib/utils";

/** 별 상점: 관심 분야 학습에서 모은 별로 선생님이 등록한 상품을 교환한다 */
export default async function ShopPage() {
  if (!hasShop()) redirect("/s");
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const { student, classRoom } = session;

  const [{ ready, items, purchases }, earned] = await Promise.all([loadShop(classRoom.id), earnedStars([student.id])]);
  const mine = purchases.filter((p) => p.studentId === student.id);
  const wallet = walletOf(earned.get(student.id) ?? 0, mine);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-grey-50 pb-12 md:max-w-3xl md:px-6 lg:max-w-5xl lg:px-8">
      <div className="bg-white md:mt-6 md:rounded-3xl">
        <header className="flex h-14 items-center px-3 md:px-6">
          <Link href="/s" className="inline-flex items-center gap-1 rounded-full p-2 text-[15px] font-medium text-grey-600 hover:bg-grey-100">
            <ChevronLeft className="size-5" />
            {classRoom.name}
          </Link>
        </header>
        <section className="flex items-end justify-between gap-3 px-5 pb-6 pt-2 md:px-8">
          <div>
            <h1 className="text-[24px] font-bold leading-snug tracking-tight md:text-[28px]">별 상점</h1>
            <p className="mt-1 text-[14px] text-grey-500">관심 분야 학습에서 모은 별로 선생님이 준비한 선물을 바꿔요.</p>
          </div>
          <div className="shrink-0 rounded-2xl bg-[#fff8e1] px-4 py-2 text-center">
            <span className="block text-[12px] font-semibold text-grey-500">쓸 수 있는 별</span>
            <span className="block text-[24px] font-bold leading-tight">
              <span className="text-[#f5b301]">★</span> {wallet.balance}
            </span>
          </div>
        </section>
        <p className="border-t border-grey-100 px-5 py-3 text-[13px] text-grey-500 md:px-8">
          모은 별 {wallet.earned}개 · 교환에 쓴 별 {wallet.spent}개 · 별을 써도 열린 기사는 그대로예요.{" "}
          <Link href="/s/explore" className="font-semibold text-primary underline-offset-2 hover:underline">
            별 더 모으기
          </Link>
        </p>
      </div>

      {!ready ? (
        <p className="mx-5 mt-3 rounded-3xl bg-white px-5 py-6 text-center text-[15px] text-grey-500 md:mx-0">
          별 상점을 준비하고 있어요. 곧 열려요!
        </p>
      ) : items.length === 0 ? (
        <div className="mx-5 mt-3 rounded-3xl bg-white md:mx-0">
          <EmptyState icon="🛍️" title="아직 상품이 없어요" description="선생님이 상품을 올리면 여기에 나타나요. 그동안 별을 모아 두세요!" />
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2.5 px-5 md:grid-cols-3 md:gap-3 md:px-0 lg:grid-cols-4">
          {items.map((item) => {
            const myCount = mine.filter((p) => p.itemId === item.id).length;
            return (
              <li key={item.id} className="flex flex-col rounded-3xl bg-white p-4 md:p-5">
                <span className="text-[40px] leading-none" aria-hidden>
                  {item.emoji}
                </span>
                <p className="mt-3 text-[16px] font-bold leading-snug text-grey-900">{item.name}</p>
                {item.description && <p className="mt-1 text-[13px] leading-relaxed text-grey-500">{item.description}</p>}
                <div className="mt-auto pt-3">
                  <p className="text-[18px] font-bold text-grey-900">
                    <span className="text-[#f5b301]">★</span> {item.price}
                  </p>
                  <p className="mt-0.5 text-[12px] text-grey-500">
                    {item.stock === null ? "수량 넉넉" : `남은 수량 ${item.stock}개`}
                    {item.perStudentLimit !== null && ` · 1인당 ${item.perStudentLimit}개 (내가 ${myCount}개)`}
                  </p>
                  <ShopBuyButton itemId={item.id} label={item.name} price={item.price} blocked={blockReason(item, wallet, mine)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {mine.length > 0 && (
        <section className="mt-8 px-5 md:px-0">
          <h2 className="mb-3 text-[17px] font-bold text-grey-800">내 교환 기록</h2>
          <ul className="divide-y divide-grey-100 rounded-3xl bg-white px-5 md:px-6">
            {mine.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3.5">
                <span className="text-[24px]" aria-hidden>
                  {p.itemEmoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-grey-800">{p.itemName}</span>
                  <span className="text-[12px] text-grey-500">{formatDateTime(p.createdAt)}</span>
                </span>
                <span className="shrink-0 text-[14px] font-semibold text-grey-600">★ -{p.price}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-center text-[13px] text-grey-400">
        <Byline />
      </p>
    </main>
  );
}
