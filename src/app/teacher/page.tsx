import Link from "next/link";
import { redirect } from "next/navigation";
import { ModeNotice } from "@/components/ModeNotice";
import { CreateClassButton } from "@/components/teacher/CreateClassButton";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { Badge, Card, ChevronRight, EmptyState } from "@/components/ui";
import { getDb } from "@/lib/db";
import { GRADES } from "@/lib/grades";
import { getTeacher } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export default async function TeacherHome() {
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");

  const db = getDb();
  const classes = await db.listClasses(teacher.id);
  const rows = await Promise.all(
    classes.map(async (c) => {
      const [students, worksheets] = await Promise.all([db.listStudents(c.id), db.listWorksheets(c.id)]);
      return { classRoom: c, studentCount: students.length, worksheetCount: worksheets.length, latest: worksheets[0] };
    }),
  );

  return (
    <TeacherShell teacher={teacher}>
      <ModeNotice className="mb-6" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">우리 반</h1>
          <p className="mt-1 text-[15px] text-grey-500">반을 골라 학습지를 만들고 결과를 확인하세요.</p>
        </div>
        {rows.length > 0 && <CreateClassButton />}
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon="🏫"
            title="첫 반을 만들어 볼까요?"
            description="반을 만들면 학생들이 입장할 반 코드가 생겨요."
            action={<CreateClassButton label="반 만들기" size="lg" />}
          />
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {rows.map(({ classRoom, studentCount, worksheetCount, latest }) => (
            <Link
              key={classRoom.id}
              href={`/teacher/classes/${classRoom.id}`}
              className="group rounded-3xl bg-white p-6 transition hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] active:scale-[0.99]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <Badge tone="blue">{GRADES[classRoom.gradeLevel].label}</Badge>
                  <p className="mt-2.5 text-[20px] font-bold text-grey-900">{classRoom.name}</p>
                </div>
                <ChevronRight className="size-5 text-grey-300 transition group-hover:text-grey-500" />
              </div>
              <div className="mt-5 flex gap-6 text-[14px]">
                <span className="text-grey-500">
                  학생 <b className="text-grey-800">{studentCount}명</b>
                </span>
                <span className="text-grey-500">
                  학습지 <b className="text-grey-800">{worksheetCount}개</b>
                </span>
                <span className="text-grey-500">
                  코드 <b className="font-mono text-grey-800">{classRoom.code}</b>
                </span>
              </div>
              {latest && (
                <p className="mt-3 truncate text-[13px] text-grey-400">
                  최근: {latest.title} · {formatDate(latest.createdAt)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </TeacherShell>
  );
}
