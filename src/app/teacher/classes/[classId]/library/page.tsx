import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { type PickerArticle, LibraryPicker } from "@/components/teacher/LibraryPicker";
import { LibrarySeenMarker } from "@/components/teacher/LibrarySeenMarker";
import { PrintButton } from "@/components/teacher/PrintButton";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ChevronLeft } from "@/components/ui";
import { getDb } from "@/lib/db";
import { CURRICULUM_STANDARDS, describeStandard } from "@/lib/curriculum-standards";
import { GRADES } from "@/lib/grades";
import { FIELD_ORDER, LIBRARY_FIELDS, libraryPicksOf, listLibraryFor, sourceNoteOf } from "@/lib/library";
import { getTeacher } from "@/lib/session";
import { formatDate } from "@/lib/utils";

const STANDARD_BY_CODE = new Map(CURRICULUM_STANDARDS.map((s) => [s.code, s]));

/** 기사에는 고른 성취기준이 "초5~6 과학 '영역' [6과05-01], ..." 꼴로 적혀 있으므로 코드를 다시 찾아 문장을 붙인다 */
function standardsOf(curriculum: string) {
  const codes = curriculum.match(/\[[^\]]+\]/g) ?? [];
  return codes.flatMap((code) => STANDARD_BY_CODE.get(code) ?? []);
}

/**
 * 관심 분야 기사 고르기: 이 반 학년군의 처음 기사와 자동 추가 기사를 모두 읽어 보고,
 * 학생에게 보일 기사를 골라 분야마다 순서를 정한 뒤 '우리 반에 올리기'로 반영한다. 브라우저 인쇄로 PDF로 저장할 수 있다.
 */
export default async function ClassLibraryPage(props: PageProps<"/teacher/classes/[classId]/library">) {
  const { classId } = await props.params;
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");

  const db = getDb();
  const classRoom = await db.getClass(classId);
  if (!classRoom || classRoom.teacherId !== teacher.id) notFound();

  // 번호는 처음 기사 다음 자동 기사(만든 순서)라 새 기사가 늘어도 바뀌지 않는다
  const [all, picks, students] = await Promise.all([listLibraryFor(classRoom.gradeLevel), libraryPicksOf(classId), db.listStudents(classId)]);
  const submissions = await db.listLibrarySubmissions(students.map((s) => s.id)).catch(() => []);
  const readers = new Map<string, number>();
  for (const s of submissions) if (s.readAt) readers.set(s.articleId, (readers.get(s.articleId) ?? 0) + 1);

  const known = new Set(all.map((a) => a.id));
  const articles: PickerArticle[] = all.map((a, i) => ({
    id: a.id,
    no: i + 1,
    field: a.field,
    addedBy: a.addedBy,
    keyword: a.keyword,
    title: a.title,
    date: formatDate(a.createdAt),
    standards: standardsOf(a.curriculum).map((s) => ({ code: s.code, label: describeStandard(s).replace(` ${s.code}`, ""), text: s.text })),
    curriculum: a.curriculum,
    paragraphs: a.paragraphs,
    source: `${a.origin.site} — ${a.origin.title} (${a.origin.url})`,
    sourceNote: sourceNoteOf(a.origin),
    readers: readers.get(a.id) ?? 0,
  }));
  const autos = all.filter((a) => a.addedBy === "auto");
  const gradeLabel = GRADES[classRoom.gradeLevel].label;

  return (
    <TeacherShell teacher={teacher}>
      <LibrarySeenMarker classId={classId} latest={autos.at(-1)?.createdAt ?? null} />
      <div className="print:hidden">
        <Link
          href={`/teacher/classes/${classId}/worksheets`}
          className="inline-flex items-center gap-1 text-[14px] font-medium text-grey-500 hover:text-grey-800"
        >
          <ChevronLeft className="size-4" />
          학습지 관리
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">📚 관심 분야 기사 고르기</h1>
            <p className="mt-1 text-[14px] leading-relaxed text-grey-500">
              {gradeLabel} 관심 분야 기사 {all.length}편(처음 넣어 둔 기사 {all.length - autos.length}편, 매주 자동 추가 기사 {autos.length}편)이에요.
              학생에게 보일 기사를 목록에 넣고 분야마다 순서를 정한 뒤 &lsquo;우리 반에 올리기&rsquo;를 눌러 주세요. 올린 기사만 학생에게 보여요.
            </p>
          </div>
          <PrintButton />
        </div>
      </div>

      <h1 className="hidden text-[20pt] font-bold print:block">관심 분야 기사 · {gradeLabel}</h1>

      <LibraryPicker
        classId={classId}
        fields={FIELD_ORDER.map((key) => ({ key, label: LIBRARY_FIELDS[key].label, emoji: LIBRARY_FIELDS[key].emoji }))}
        articles={articles}
        initial={picks.filter((id) => known.has(id))}
      />
    </TeacherShell>
  );
}
