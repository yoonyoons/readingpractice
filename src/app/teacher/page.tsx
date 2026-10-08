import Link from "next/link";
import { redirect } from "next/navigation";
import { ModeNotice } from "@/components/ModeNotice";
import { CreateClassButton } from "@/components/teacher/CreateClassButton";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { Badge, buttonClass, Card, CardHeading, ChevronRight, EmptyState } from "@/components/ui";
import { getDb } from "@/lib/db";
import { GRADES } from "@/lib/grades";
import { getTeacher } from "@/lib/session";
import { formatDate } from "@/lib/utils";

/** 학교 제출용 서식 (public/forms). 학교명·담당 교사·날짜 칸은 비어 있어 학교에서 채워 쓴다. */
const SCHOOL_FORMS = [
  { href: "/forms/parent-consent.hwpx", fileName: "학부모 개인정보 수집·이용 및 국외 이전 동의서.hwpx", label: "학부모 동의서" },
  { href: "/forms/school-committee-review.hwpx", fileName: "학교운영위원회 학습지원 소프트웨어 심의 안건.hwpx", label: "학교운영위원회 심의 양식" },
];

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

      <Card className="mt-8">
        <CardHeading icon="📄" eyebrow="학교 제출용 서식 (한글 hwpx)" title="동의서·심의 양식 내려받기" />
        <p className="mt-3 text-[14px] leading-relaxed text-grey-600">
          만 14세 미만 학생은 가입 전에 보호자 동의가 필요해요. 학교운영위원회 심의를 거친 뒤 동의서를 받은 학생만 입장하게 해
          주세요. 학교명·담당 교사·날짜 칸은 학교에 맞게 채워 쓰세요.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SCHOOL_FORMS.map((form) => (
            <a key={form.href} href={form.href} download={form.fileName} className={buttonClass("secondary", "md")}>
              {form.label}
            </a>
          ))}
        </div>
      </Card>
    </TeacherShell>
  );
}
