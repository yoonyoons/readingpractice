import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { ClassInsights } from "@/components/teacher/ClassInsights";
import { ClassCode, DeleteClassButton } from "@/components/teacher/ClassTools";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { WorksheetCreatePanel } from "@/components/teacher/WorksheetCreatePanel";
import { WorksheetRow } from "@/components/teacher/WorksheetRow";
import { Badge, Card, ChevronLeft, ChevronRight, LinkButton } from "@/components/ui";
import { getDb } from "@/lib/db";
import { listLibraryArticles, totalStars } from "@/lib/library";
import { isDemoTeacher } from "@/lib/demo-account";
import { hasShop, isDemoGeneration } from "@/lib/env";
import { GRADES } from "@/lib/grades";
import { buildClassReport, TREND_WEEKS } from "@/lib/report";
import { loadClassReport } from "@/lib/report-ai";
import { getTeacher } from "@/lib/session";
import { loadShop, walletOf } from "@/lib/shop";
import { shopSeenCookie, unseenPurchases } from "@/lib/shop-rules";
import { recentWeekKeys, seoulDate } from "@/lib/utils";
import { findLoadedWorksheet, getWeeklySet, readyArticles } from "@/lib/weekly";

/** 첫 화면에 바로 보이는 최근 학습지 수. 전체 목록은 '학습지 관리' 화면에서 본다 */
const RECENT_WORKSHEETS = 5;

export default async function ClassPage(props: PageProps<"/teacher/classes/[classId]">) {
  const { classId } = await props.params;
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");

  const db = getDb();
  const classRoom = await db.getClass(classId);
  if (!classRoom || classRoom.teacherId !== teacher.id) notFound();

  const [students, worksheets, weekly] = await Promise.all([
    db.listStudents(classId),
    db.listWorksheets(classId),
    getWeeklySet(classRoom.gradeLevel),
  ]);
  const [submissionLists, report, libraryArticles, librarySubs, shop] = await Promise.all([
    Promise.all(worksheets.map((w) => db.listSubmissionsByWorksheet(w.id))),
    loadClassReport(classId),
    listLibraryArticles(),
    db.listLibrarySubmissions(students.map((s) => s.id)).catch((e) => {
      console.error("관심 분야 학습 기록을 불러오지 못했어요", e);
      return [];
    }),
    loadShop(classId),
  ]);
  const stars = totalStars(libraryArticles, librarySubs);
  // 결과 분석표와 성적 추이가 같은 기간을 보도록 이번 주를 포함한 최근 4주의 월요일부터 센다
  const weeks = recentWeekKeys(TREND_WEEKS);
  const range = { from: weeks[0], to: seoulDate(new Date()) };
  const recentStats = buildClassReport(students, worksheets, submissionLists.flat(), range);

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const grade = GRADES[classRoom.gradeLevel];
  const joinUrl = `${protocol}://${host}/join`;
  // 학생이 찍으면 입장 화면에 반 코드가 채워진 채로 열린다
  const qrSvg = await QRCode.toString(`${joinUrl}?code=${classRoom.code}`, { type: "svg", margin: 0 });

  // 선생님이 상점 페이지에서 아직 보지 못한 교환 수 (🔔)
  const newPurchases = unseenPurchases(shop.purchases, (await cookies()).get(shopSeenCookie(classId))?.value);

  return (
    <TeacherShell teacher={teacher}>
      <Link href="/teacher" className="inline-flex items-center gap-1 text-[14px] font-medium text-grey-500 hover:text-grey-800">
        <ChevronLeft className="size-4" />
        우리 반
      </Link>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[26px] font-bold tracking-tight">{classRoom.name}</h1>
          <Badge tone="blue">{grade.label}</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LinkButton href={`/teacher/classes/${classRoom.id}/worksheets`} variant="grey" size="sm">
            📚 학습지 관리
          </LinkButton>
          {hasShop() && (
            <LinkButton href={`/teacher/classes/${classRoom.id}/shop`} variant="grey" size="sm">
              🛍️ 별 상점
              {newPurchases > 0 && (
                <span
                  className="rounded-full bg-danger-weak px-1.5 text-[12px] font-bold text-danger"
                  title={`새 교환 ${newPurchases}건`}
                >
                  🔔 {newPurchases}
                </span>
              )}
            </LinkButton>
          )}
          {/* 체험 계정의 반은 누구나 같이 쓰므로 지울 수 없게 한다 */}
          {!isDemoTeacher(teacher) && <DeleteClassButton classId={classRoom.id} name={classRoom.name} />}
        </div>
      </div>

      <ClassInsights
        classId={classRoom.id}
        students={students.map((s) => ({
          id: s.id,
          number: s.number,
          name: s.name,
          hasPin: Boolean(s.pinHash),
          lastLoginAt: s.lastLoginAt ?? null,
          stars: stars.get(s.id) ?? 0,
          balance: walletOf(stars.get(s.id) ?? 0, shop.purchases.filter((p) => p.studentId === s.id)).balance,
        }))}
        stats={recentStats}
        weeks={weeks}
        range={range}
        report={{ pending: Boolean(report?.pending), completedAt: report?.completedAt ?? null }}
        aside={<ClassCode code={classRoom.code} joinUrl={joinUrl} qrSvg={qrSvg} />}
      >
        <WorksheetCreatePanel
          classId={classRoom.id}
          gradeLabel={grade.label}
          weeklyReady={readyArticles(weekly).length > 0 || isDemoGeneration()}
          weeklyCanBuild={!isDemoTeacher(teacher)}
          weeklyLoaded={Boolean(findLoadedWorksheet(worksheets, weekly))}
        />

        <Card>
          <h2 className="text-[18px] font-bold">학습지</h2>
          {worksheets.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-grey-50 px-4 py-8 text-center text-[14px] text-grey-500">
              아직 만든 학습지가 없어요.
            </p>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-grey-100">
                {worksheets.slice(0, RECENT_WORKSHEETS).map((w, i) => (
                  <WorksheetRow key={w.id} classId={classRoom.id} worksheet={w} students={students} submissions={submissionLists[i]} />
                ))}
              </ul>
              {worksheets.length > RECENT_WORKSHEETS && (
                <Link
                  href={`/teacher/classes/${classRoom.id}/worksheets`}
                  className="-mx-3 mt-1 flex items-center justify-center gap-1 rounded-2xl border-t border-grey-100 px-3 pt-3 pb-2.5 text-[14px] font-semibold text-grey-500 transition hover:bg-grey-50 hover:text-grey-700"
                >
                  학습지 전체 {worksheets.length}개 보기
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </>
          )}
        </Card>

      </ClassInsights>
    </TeacherShell>
  );
}
