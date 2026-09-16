import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportView } from "@/components/teacher/ReportView";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ChevronLeft } from "@/components/ui";
import { getDb } from "@/lib/db";
import { isDemoTeacher } from "@/lib/demo-account";
import { hasAnthropic } from "@/lib/env";
import { GRADES } from "@/lib/grades";
import { buildClassReport } from "@/lib/report";
import { loadClassReport } from "@/lib/report-ai";
import { getTeacher } from "@/lib/session";
import { recentDays } from "@/lib/utils";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportPage(props: PageProps<"/teacher/classes/[classId]/report">) {
  const [{ classId }, query] = await Promise.all([props.params, props.searchParams]);
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");

  const db = getDb();
  const classRoom = await db.getClass(classId);
  if (!classRoom || classRoom.teacherId !== teacher.id) notFound();

  // 기간을 고르지 않았으면 최근 4주
  const fallback = recentDays(28);
  const pick = (value: string | string[] | undefined, other: string) =>
    typeof value === "string" && DATE.test(value) ? value : other;
  let from = pick(query.from, fallback.from);
  let to = pick(query.to, fallback.to);
  if (from > to) [from, to] = [to, from];

  const [students, worksheets, report] = await Promise.all([
    db.listStudents(classId),
    db.listWorksheets(classId),
    loadClassReport(classId),
  ]);
  const submissions = (await Promise.all(worksheets.map((w) => db.listSubmissionsByWorksheet(w.id)))).flat();
  const stats = buildClassReport(students, worksheets, submissions, { from, to });

  return (
    <TeacherShell teacher={teacher}>
      <Link
        href={`/teacher/classes/${classId}`}
        className="inline-flex items-center gap-1 text-[14px] font-medium text-grey-500 hover:text-grey-800"
      >
        <ChevronLeft className="size-4" />
        {classRoom.name}
      </Link>
      <h1 className="mt-3 text-[26px] font-bold tracking-tight">결과 분석표</h1>
      <p className="mt-1 text-[15px] text-grey-500">
        {GRADES[classRoom.gradeLevel].label} · 학생이 제출한 날짜를 기준으로 어휘 퀴즈와 요약 결과를 모아 봐요.
      </p>

      <ReportView
        key={`${from}:${to}:${report?.updatedAt ?? ""}`}
        classId={classId}
        range={{ from, to }}
        stats={stats}
        report={
          report && {
            comments: report.comments,
            commentsFrom: report.commentsFrom,
            commentsTo: report.commentsTo,
            completedAt: report.completedAt,
            error: report.error,
            pending: report.pending && {
              from: report.pending.from,
              to: report.pending.to,
              requestedAt: report.pending.requestedAt,
              count: Object.values(report.pending.groups).flat().length + Object.keys(report.pending.presets).length,
            },
          }
        }
        demo={isDemoTeacher(teacher) || !hasAnthropic()}
        initialStudentId={stats.students.find((s) => s.studentId === query.student)?.studentId ?? null}
      />
    </TeacherShell>
  );
}
