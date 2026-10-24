import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { ClassInsights } from "@/components/teacher/ClassInsights";
import { ClassCode, DeleteClassButton } from "@/components/teacher/ClassTools";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { WorksheetCreatePanel } from "@/components/teacher/WorksheetCreatePanel";
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
import { formatDate, isArticleDone, recentWeekKeys, seoulDate } from "@/lib/utils";
import { findLoadedWorksheet, getWeeklySet, readyArticles } from "@/lib/weekly";

/** 첫 화면에 바로 보이는 최근 학습지 수. 나머지는 '보관된 학습지'로 접어 둔다 */
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

  // 학습지 한 줄 (i는 submissionLists와 맞춘 전체 목록에서의 위치)
  const worksheetRow = (w: (typeof worksheets)[number], i: number) => {
    const ready = w.articles.filter((a) => a.status === "ready");
    // 이 학습지의 기사를 모두 끝낸 학생 수
    const doneStudents = students.filter((student) =>
      ready.every((article) => {
        const sub = submissionLists[i].find((s) => s.studentId === student.id && s.articleId === article.id);
        return sub ? isArticleDone(article, sub) : false;
      }),
    ).length;
    return (
      <li key={w.id}>
        <Link
          href={`/teacher/classes/${classRoom.id}/worksheets/${w.id}`}
          className="-mx-3 flex items-center gap-3 rounded-2xl px-3 py-3.5 transition hover:bg-grey-50"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge tone={w.status === "published" ? "green" : "grey"}>{w.status === "published" ? "배포 중" : "초안"}</Badge>
              <span className="truncate text-[16px] font-semibold text-grey-800">{w.title}</span>
            </div>
            <p className="mt-1 truncate text-[13px] text-grey-500">
              {formatDate(w.createdAt)} · {w.articles.map((a) => a.topic).join(" · ")}
            </p>
          </div>
          {w.status === "published" && ready.length > 0 && students.length > 0 && (
            <span className="shrink-0 text-[13px] font-semibold text-primary">
              학습 완료 {doneStudents}/{students.length}명
            </span>
          )}
          <ChevronRight className="size-5 shrink-0 text-grey-300" />
        </Link>
      </li>
    );
  };

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
        {/* 체험 계정의 반은 누구나 같이 쓰므로 지울 수 없게 한다 */}
        {!isDemoTeacher(teacher) && <DeleteClassButton classId={classRoom.id} name={classRoom.name} />}
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
              <ul className="mt-3 divide-y divide-grey-100">{worksheets.slice(0, RECENT_WORKSHEETS).map(worksheetRow)}</ul>
              {worksheets.length > RECENT_WORKSHEETS && (
                <details className="group mt-1 border-t border-grey-100 pt-2">
                  <summary className="-mx-3 flex cursor-pointer list-none items-center justify-center gap-1 rounded-2xl px-3 py-2.5 text-[14px] font-semibold text-grey-500 transition hover:bg-grey-50 hover:text-grey-700 [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">보관된 학습지 {worksheets.length - RECENT_WORKSHEETS}개 보기</span>
                    <span className="hidden group-open:inline">보관된 학습지 접기</span>
                    <ChevronRight className="size-4 rotate-90 transition group-open:-rotate-90" />
                  </summary>
                  <ul className="divide-y divide-grey-100">
                    {worksheets.slice(RECENT_WORKSHEETS).map((w, i) => worksheetRow(w, i + RECENT_WORKSHEETS))}
                  </ul>
                </details>
              )}
            </>
          )}
        </Card>

        {hasShop() && (
          <Card className="flex flex-wrap items-center gap-4">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff8e1] text-[24px]">
              🛍️
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-bold">별 상점</h2>
              <p className="mt-0.5 text-[13px] text-grey-500">
                {shop.ready
                  ? `상품 ${shop.items.length}개 · 교환 ${shop.purchases.length}건 · 학생들이 모은 별로 상품을 바꿔요`
                  : "운영 DB 준비가 필요해요"}
              </p>
            </div>
            <LinkButton href={`/teacher/classes/${classRoom.id}/shop`} variant="secondary" size="md">
              상점 관리
            </LinkButton>
          </Card>
        )}
      </ClassInsights>
    </TeacherShell>
  );
}
