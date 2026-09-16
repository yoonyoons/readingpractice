import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ClassInsights } from "@/components/teacher/ClassInsights";
import { ClassCode, DeleteClassButton } from "@/components/teacher/ClassTools";
import { CustomWorksheetPanel } from "@/components/teacher/CustomWorksheetPanel";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { WeeklyArticlesPanel } from "@/components/teacher/WeeklyArticlesPanel";
import { Badge, Card, ChevronLeft, ChevronRight } from "@/components/ui";
import { getDb } from "@/lib/db";
import { isDemoTeacher } from "@/lib/demo-account";
import { isDemoGeneration } from "@/lib/env";
import { GRADES } from "@/lib/grades";
import { buildClassReport, TREND_WEEKS } from "@/lib/report";
import { loadClassReport } from "@/lib/report-ai";
import { getTeacher } from "@/lib/session";
import { formatDate, isArticleDone, recentWeekKeys, seoulDate, weekLabel } from "@/lib/utils";
import { findLoadedWorksheet, getWeeklySet, readyArticles } from "@/lib/weekly";

export default async function ClassPage(props: PageProps<"/teacher/classes/[classId]">) {
  const { classId } = await props.params;
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");

  const db = getDb();
  const classRoom = await db.getClass(classId);
  if (!classRoom || classRoom.teacherId !== teacher.id) notFound();

  const demo = isDemoGeneration() || isDemoTeacher(teacher);
  const [students, worksheets, weekly] = await Promise.all([
    db.listStudents(classId),
    db.listWorksheets(classId),
    getWeeklySet(classRoom.gradeLevel),
  ]);
  const [submissionLists, report] = await Promise.all([
    Promise.all(worksheets.map((w) => db.listSubmissionsByWorksheet(w.id))),
    loadClassReport(classId),
  ]);
  // 결과 분석표와 성적 추이가 같은 기간을 보도록 이번 주를 포함한 최근 4주의 월요일부터 센다
  const weeks = recentWeekKeys(TREND_WEEKS);
  const range = { from: weeks[0], to: seoulDate(new Date()) };
  const recentStats = buildClassReport(students, worksheets, submissionLists.flat(), range);

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const grade = GRADES[classRoom.gradeLevel];

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
        <DeleteClassButton classId={classRoom.id} name={classRoom.name} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* 학습지를 만드는 두 가지 길(불러오기 · 직접 제작)을 같은 높이로 나란히 둔다 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <WeeklyArticlesPanel
              classId={classRoom.id}
              gradeLabel={grade.label}
              weekLabel={weekLabel()}
              articles={readyArticles(weekly).map((a) => ({
                title: a.title,
                topic: a.topic,
                sourceCount: a.sources.length,
                demo: a.sourceMode === "demo",
              }))}
              loadedWorksheetId={findLoadedWorksheet(worksheets, weekly)?.id ?? null}
              prepareOnLoad={isDemoGeneration()}
            />
            <CustomWorksheetPanel classId={classRoom.id} gradeLabel={grade.label} demo={demo} />
          </div>

          <Card>
            <h2 className="text-[18px] font-bold">학습지</h2>
            {worksheets.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-grey-50 px-4 py-8 text-center text-[14px] text-grey-500">
                아직 만든 학습지가 없어요.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-grey-100">
                {worksheets.map((w, i) => {
                  const ready = w.articles.filter((a) => a.status === "ready");
                  const doneCount = submissionLists[i].filter((s) => {
                    const article = ready.find((a) => a.id === s.articleId);
                    return article ? isArticleDone(article, s) : false;
                  }).length;
                  const total = ready.length * students.length;
                  return (
                    <li key={w.id}>
                      <Link
                        href={`/teacher/classes/${classRoom.id}/worksheets/${w.id}`}
                        className="-mx-3 flex items-center gap-3 rounded-2xl px-3 py-3.5 transition hover:bg-grey-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge tone={w.status === "published" ? "green" : "grey"}>
                              {w.status === "published" ? "배포 중" : "초안"}
                            </Badge>
                            <span className="truncate text-[16px] font-semibold text-grey-800">{w.title}</span>
                          </div>
                          <p className="mt-1 truncate text-[13px] text-grey-500">
                            {formatDate(w.createdAt)} · {w.articles.map((a) => a.topic).join(" · ")}
                          </p>
                        </div>
                        {w.status === "published" && total > 0 && (
                          <span className="shrink-0 text-[13px] font-semibold text-primary">
                            학습 완료 {doneCount}/{total}
                          </span>
                        )}
                        <ChevronRight className="size-5 shrink-0 text-grey-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <ClassCode code={classRoom.code} joinUrl={`${protocol}://${host}/join`} />
          <ClassInsights
            classId={classRoom.id}
            students={students.map((s) => ({ id: s.id, number: s.number, name: s.name, hasPin: Boolean(s.pinHash) }))}
            stats={recentStats}
            weeks={weeks}
            range={range}
            report={{ pending: Boolean(report?.pending), completedAt: report?.completedAt ?? null }}
          />
        </div>
      </div>
    </TeacherShell>
  );
}
