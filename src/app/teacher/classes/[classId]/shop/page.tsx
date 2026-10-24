import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShopManager } from "@/components/teacher/ShopManager";
import { ShopSeenMarker } from "@/components/teacher/ShopSeenMarker";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { Card, ChevronLeft } from "@/components/ui";
import { getDb } from "@/lib/db";
import { hasShop } from "@/lib/env";
import { getTeacher } from "@/lib/session";
import { classWallets, earnedStars, loadShop } from "@/lib/shop";
import { formatDateTime } from "@/lib/utils";

/** 교환 기록은 최근 것만 보여 준다 */
const RECENT_PURCHASES = 50;

export default async function ClassShopPage(props: PageProps<"/teacher/classes/[classId]/shop">) {
  const { classId } = await props.params;
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");
  if (!hasShop()) redirect(`/teacher/classes/${classId}`);

  const db = getDb();
  const classRoom = await db.getClass(classId);
  if (!classRoom || classRoom.teacherId !== teacher.id) notFound();

  const students = await db.listStudents(classId);
  const [{ ready, items, purchases }, earned] = await Promise.all([loadShop(classId), earnedStars(students.map((s) => s.id))]);
  const wallets = classWallets(students.map((s) => s.id), earned, purchases);
  const nameOf = new Map(students.map((s) => [s.id, `${s.number}번 ${s.name}`]));
  const soldCount: Record<string, number> = {};
  for (const p of purchases) soldCount[p.itemId] = (soldCount[p.itemId] ?? 0) + 1;

  return (
    <TeacherShell teacher={teacher}>
      {/* 교환 기록은 최신순이라 맨 앞이 가장 최근 교환 */}
      <ShopSeenMarker classId={classId} latest={purchases[0]?.createdAt ?? null} />
      <Link
        href={`/teacher/classes/${classId}`}
        className="inline-flex items-center gap-1 text-[14px] font-medium text-grey-500 hover:text-grey-800"
      >
        <ChevronLeft className="size-4" />
        {classRoom.name}
      </Link>
      <h1 className="mt-3 text-[26px] font-bold tracking-tight">🛍️ 별 상점</h1>
      <p className="mt-1 text-[14px] text-grey-500">
        학생들이 관심 분야 학습에서 모은 별로 상품을 교환해요. 교환하면 바로 별이 빠지니, 교환 기록을 보고 상품을 나눠 주세요.
      </p>

      {!ready ? (
        <Card className="mt-6">
          <p className="text-[15px] text-grey-600">
            별 상점을 쓰려면 운영 DB(Supabase)에 표가 더 필요해요. <code>supabase/schema.sql</code>을 다시 실행해 주세요.
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-5">
            <ShopManager classId={classId} items={items} soldCount={soldCount} />

            <Card>
              <h2 className="text-[18px] font-bold">교환 기록</h2>
              {purchases.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-grey-50 px-4 py-8 text-center text-[14px] text-grey-500">아직 교환한 학생이 없어요.</p>
              ) : (
                <ul className="mt-3 divide-y divide-grey-100">
                  {purchases.slice(0, RECENT_PURCHASES).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-3">
                      <span className="text-[22px]" aria-hidden>
                        {p.itemEmoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-grey-800">
                          {nameOf.get(p.studentId) ?? "삭제된 학생"} · {p.itemName}
                        </span>
                        <span className="text-[12px] text-grey-500">{formatDateTime(p.createdAt)}</span>
                      </span>
                      <span className="shrink-0 text-[14px] font-semibold text-grey-600">★ -{p.price}</span>
                    </li>
                  ))}
                </ul>
              )}
              {purchases.length > RECENT_PURCHASES && (
                <p className="mt-2 text-center text-[12px] text-grey-500">최근 {RECENT_PURCHASES}건만 보여요.</p>
              )}
            </Card>
          </div>

          <Card className="lg:sticky lg:top-24">
            <h2 className="text-[18px] font-bold">학생별 별</h2>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_44px_44px_52px] gap-2 border-b border-grey-100 pb-1.5 text-right text-[12px] text-grey-400">
              <span className="text-left">학생</span>
              <span>모은</span>
              <span>쓴</span>
              <span>남은</span>
            </div>
            {students.length === 0 ? (
              <p className="mt-4 text-center text-[14px] text-grey-500">아직 입장한 학생이 없어요.</p>
            ) : (
              <ul className="max-h-[480px] overflow-y-auto overscroll-contain">
                {students.map((s) => {
                  const w = wallets.get(s.id)!;
                  return (
                    <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_44px_44px_52px] items-center gap-2 py-2 text-right text-[14px] tabular-nums">
                      <span className="truncate text-left font-semibold text-grey-800">
                        <span className="mr-1.5 text-[13px] font-medium text-grey-400">{s.number}</span>
                        {s.name}
                      </span>
                      <span className="text-grey-600">{w.earned}</span>
                      <span className="text-grey-600">{w.spent}</span>
                      <span className="font-bold text-grey-900">
                        <span className="text-[#f5b301]">★</span>
                        {w.balance}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </TeacherShell>
  );
}
