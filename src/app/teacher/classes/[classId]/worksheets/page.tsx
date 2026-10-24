import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { WorksheetRow } from "@/components/teacher/WorksheetRow";
import { Card, ChevronLeft } from "@/components/ui";
import { getDb } from "@/lib/db";
import { getTeacher } from "@/lib/session";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "published", label: "배포 중" },
  { key: "draft", label: "초안" },
] as const;

export default async function ClassWorksheetsPage(props: PageProps<"/teacher/classes/[classId]/worksheets">) {
  const [{ classId }, query] = await Promise.all([props.params, props.searchParams]);
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");

  const db = getDb();
  const classRoom = await db.getClass(classId);
  if (!classRoom || classRoom.teacherId !== teacher.id) notFound();

  const [students, worksheets] = await Promise.all([db.listStudents(classId), db.listWorksheets(classId)]);
  const filter = FILTERS.find((f) => f.key === query.status)?.key ?? "all";
  const count = (key: (typeof FILTERS)[number]["key"]) =>
    key === "all" ? worksheets.length : worksheets.filter((w) => w.status === key).length;
  const shown = filter === "all" ? worksheets : worksheets.filter((w) => w.status === filter);
  const submissionLists = await Promise.all(shown.map((w) => db.listSubmissionsByWorksheet(w.id)));

  return (
    <TeacherShell teacher={teacher}>
      <Link
        href={`/teacher/classes/${classId}`}
        className="inline-flex items-center gap-1 text-[14px] font-medium text-grey-500 hover:text-grey-800"
      >
        <ChevronLeft className="size-4" />
        {classRoom.name}
      </Link>
      <div className="mt-3 flex items-end justify-between gap-3">
        <h1 className="text-[26px] font-bold tracking-tight">📚 학습지 관리</h1>
        <span className="text-[14px] text-grey-500">전체 {worksheets.length}개</span>
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? `/teacher/classes/${classId}/worksheets` : `/teacher/classes/${classId}/worksheets?status=${f.key}`}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
                filter === f.key ? "bg-grey-800 text-white" : "bg-grey-100 text-grey-600 hover:bg-grey-200",
              )}
            >
              {f.label} {count(f.key)}
            </Link>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-grey-50 px-4 py-8 text-center text-[14px] text-grey-500">
            {worksheets.length === 0 ? "아직 만든 학습지가 없어요." : "이 상태의 학습지가 없어요."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-grey-100">
            {shown.map((w, i) => (
              <WorksheetRow key={w.id} classId={classId} worksheet={w} students={students} submissions={submissionLists[i]} />
            ))}
          </ul>
        )}
      </Card>
    </TeacherShell>
  );
}
