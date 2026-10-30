import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ModeNotice } from "@/components/ModeNotice";
import { CreateClassButton } from "@/components/teacher/CreateClassButton";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { Badge, buttonClass, Card, ChevronRight, EmptyState } from "@/components/ui";
import { getDb } from "@/lib/db";
import { DEMO_CLASS_COOKIE, isDemoTeacher } from "@/lib/demo-account";
import { GUIDE } from "@/lib/guide";
import { GRADE_LIST, GRADES } from "@/lib/grades";
import { getTeacher } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";

/** 학교 제출용 서식 (public/forms). 학교명·담당 교사·날짜 칸은 비어 있어 학교에서 채워 쓴다. */
const SCHOOL_FORMS = [
  { href: "/forms/parent-consent.hwpx", fileName: "학부모 개인정보 수집·이용 및 국외 이전 동의서.hwpx", label: "학부모 동의서" },
  { href: "/forms/school-committee-review.hwpx", fileName: "학교운영위원회 학습지원 소프트웨어 심의 안건.hwpx", label: "학교운영위원회 심의 양식" },
];

export default async function TeacherHome() {
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");

  const db = getDb();
  const demo = isDemoTeacher(teacher);
  let classes = await db.listClasses(teacher.id);
  // 체험 계정: 학년군 순서로 보여 주고, 체험 페이지에서 고른 학년군의 반을 표시한다
  const currentDemoClassId = demo ? (await cookies()).get(DEMO_CLASS_COOKIE)?.value : undefined;
  if (demo) {
    const order = GRADE_LIST.map((g) => g.level);
    classes = classes.toSorted((a, b) => order.indexOf(a.gradeLevel) - order.indexOf(b.gradeLevel));
  }
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
        {rows.length > 0 && !demo && <CreateClassButton />}
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon="🏫"
            title="첫 반을 만들어 볼까요?"
            description="반을 만들면 학생들이 입장할 반 코드가 생겨요."
            action={demo ? undefined : <CreateClassButton label="반 만들기" size="lg" />}
          />
        </Card>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {rows.map(({ classRoom, studentCount, worksheetCount, latest }) => (
            <Link
              key={classRoom.id}
              href={`/teacher/classes/${classRoom.id}`}
              className={cn(
                "group flex min-w-0 flex-col rounded-3xl bg-white p-7 transition hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] active:scale-[0.99]",
                classRoom.id === currentDemoClassId && "ring-2 ring-primary",
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="blue">{GRADES[classRoom.gradeLevel].label}</Badge>
                    {classRoom.id === currentDemoClassId && <Badge tone="orange">지금 체험 중</Badge>}
                  </div>
                  <p className="mt-3 text-[26px] font-bold tracking-tight text-grey-900">{classRoom.name}</p>
                </div>
                <ChevronRight className="size-6 text-grey-300 transition group-hover:text-grey-500" />
              </div>
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[16px]">
                <span className="text-grey-500">
                  학생 <b className="text-[18px] text-grey-800">{studentCount}명</b>
                </span>
                <span className="text-grey-500">
                  학습지 <b className="text-[18px] text-grey-800">{worksheetCount}개</b>
                </span>
                <span className="text-grey-500">
                  코드 <b className="font-mono text-[18px] text-grey-800">{classRoom.code}</b>
                </span>
              </div>
              <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                <p className="min-w-0 truncate text-[14px] text-grey-400">
                  {latest ? `최근: ${latest.title} · ${formatDate(latest.createdAt)}` : "아직 만든 학습지가 없어요"}
                </p>
                <span className={buttonClass("primary", "md", "shrink-0")}>입장하기 →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Card className="mt-5 divide-y divide-grey-100 py-2">
        <DownloadRow icon="📄" title="동의서·심의 양식 내려받기">
          {SCHOOL_FORMS.map((form) => (
            <a key={form.href} href={form.href} download={form.fileName} className={buttonClass("secondary", "sm")}>
              {form.label}
            </a>
          ))}
        </DownloadRow>
        <DownloadRow icon="📘" title="사용 안내서 내려받기">
          <a href={GUIDE.pdf} download={GUIDE.pdfName} className={buttonClass("secondary", "sm")}>
            PDF
          </a>
          <a href={GUIDE.pptx} download={GUIDE.pptxName} className={buttonClass("secondary", "sm")}>
            PowerPoint (PPTX)
          </a>
        </DownloadRow>
      </Card>
    </TeacherShell>
  );
}

/** 반 목록 아래 내려받기 줄: 반 카드보다 눈에 덜 띄도록 한 상자 안에 작게 */
function DownloadRow({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[15px] font-bold text-grey-800">
        <span aria-hidden className="mr-1.5">
          {icon}
        </span>
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
