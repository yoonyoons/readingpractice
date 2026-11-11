import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LibraryPickButton } from "@/components/teacher/LibraryPickButton";
import { LibrarySeenMarker } from "@/components/teacher/LibrarySeenMarker";
import { PrintButton } from "@/components/teacher/PrintButton";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { Badge, Card, ChevronLeft, EmptyState } from "@/components/ui";
import { getDb } from "@/lib/db";
import { CURRICULUM_STANDARDS, describeStandard } from "@/lib/curriculum-standards";
import { GRADES } from "@/lib/grades";
import { LIBRARY_FIELDS, libraryPicksOf, listLibraryFor, sourceNoteOf } from "@/lib/library";
import { getTeacher } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";

const STANDARD_BY_CODE = new Map(CURRICULUM_STANDARDS.map((s) => [s.code, s]));

/** 자동 기사는 고른 성취기준을 "초5~6 과학 '영역' [6과05-01], ..." 꼴로 적어 두므로 코드를 다시 찾아 문장을 붙인다 */
function standardsOf(curriculum: string) {
  const codes = curriculum.match(/\[[^\]]+\]/g) ?? [];
  return codes.flatMap((code) => STANDARD_BY_CODE.get(code) ?? []);
}

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "picked", label: "학생에게 추가한 기사" },
  { key: "unpicked", label: "안 고른 기사" },
] as const;

/**
 * 서버가 매주 자동으로 추가한 관심 분야 기사 중 이 반 학년군 기사의 전문.
 * 선생님이 고른 기사만 학생의 관심 분야 학습에 보인다. 브라우저 인쇄로 PDF로 저장할 수 있다.
 */
export default async function ClassLibraryPage(props: PageProps<"/teacher/classes/[classId]/library">) {
  const [{ classId }, query] = await Promise.all([props.params, props.searchParams]);
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");

  const db = getDb();
  const classRoom = await db.getClass(classId);
  if (!classRoom || classRoom.teacherId !== teacher.id) notFound();

  // 목록은 오래된 것부터라 번호가 새 기사가 늘어도 바뀌지 않는다
  const [all, picks, students] = await Promise.all([
    listLibraryFor(classRoom.gradeLevel).then((list) => list.filter((a) => a.addedBy === "auto")),
    libraryPicksOf(classId),
    db.listStudents(classId),
  ]);
  const submissions = await db.listLibrarySubmissions(students.map((s) => s.id)).catch(() => []);
  const readers = new Map<string, number>();
  for (const s of submissions) if (s.readAt) readers.set(s.articleId, (readers.get(s.articleId) ?? 0) + 1);

  const filter = FILTERS.find((f) => f.key === query.filter)?.key ?? "all";
  const count = { all: all.length, picked: all.filter((a) => picks.has(a.id)).length, unpicked: all.filter((a) => !picks.has(a.id)).length };
  const numbered = all.map((article, i) => ({ article, no: i + 1 }));
  const shown = numbered.filter(({ article }) => (filter === "all" ? true : filter === "picked" ? picks.has(article.id) : !picks.has(article.id)));
  const gradeLabel = GRADES[classRoom.gradeLevel].label;

  return (
    <TeacherShell teacher={teacher}>
      <LibrarySeenMarker classId={classId} latest={all.at(-1)?.createdAt ?? null} />
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
            <h1 className="text-[26px] font-bold tracking-tight">📚 관심 분야 자동 추가 기사</h1>
            <p className="mt-1 text-[14px] text-grey-500">
              서버가 매주 분야별로 추가한 {gradeLabel} 기사예요. 읽어 보고 &lsquo;학생에게 추가&rsquo;를 누른 기사만 학생의 관심 분야 학습에 나와요.
              인쇄 창에서 &lsquo;PDF로 저장&rsquo;을 고르면 지금 보이는 기사를 파일로 받을 수 있어요.
            </p>
          </div>
          {shown.length > 0 && <PrintButton />}
        </div>
        {all.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? `/teacher/classes/${classId}/library` : `/teacher/classes/${classId}/library?filter=${f.key}`}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
                  filter === f.key ? "bg-grey-800 text-white" : "bg-white text-grey-600 hover:bg-grey-200",
                )}
              >
                {f.label} {count[f.key]}
              </Link>
            ))}
          </div>
        )}
      </div>

      <h1 className="hidden text-[20pt] font-bold print:block">관심 분야 자동 추가 기사 전문 · {gradeLabel} ({shown.length}편)</h1>

      {shown.length === 0 ? (
        <Card className="mt-6">
          {all.length === 0 ? (
            <EmptyState icon="🗂️" title={`아직 자동으로 추가된 ${gradeLabel} 기사가 없어요`} description="서버가 매주 분야별로 새 기사를 추가하면 여기에 모여요." />
          ) : (
            <EmptyState
              icon="🗂️"
              title={filter === "picked" ? "아직 학생에게 추가한 기사가 없어요" : "모든 기사를 학생에게 추가했어요"}
              description={filter === "picked" ? "‘전체’에서 기사를 읽어 보고 ‘학생에게 추가’를 눌러 주세요." : undefined}
            />
          )}
        </Card>
      ) : (
        <div className="mt-6 space-y-5 print:mt-4 print:space-y-0">
          {shown.map(({ article, no }) => {
            const picked = picks.has(article.id);
            const read = readers.get(article.id) ?? 0;
            const standards = standardsOf(article.curriculum);
            const field = LIBRARY_FIELDS[article.field];
            return (
              <Card key={article.id} className="print:break-before-page print:rounded-none print:p-0 print:first:break-before-auto">
                <article>
                  <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-grey-500">
                    <span className="font-bold text-primary">{String(no).padStart(2, "0")}</span>
                    <Badge tone="blue">
                      {field.emoji} {field.label}
                    </Badge>
                    {article.gradeLevels.map((g) => (
                      <Badge key={g}>{GRADES[g].label}</Badge>
                    ))}
                    <span>· 키워드 「{article.keyword}」 · {formatDate(article.createdAt)} 추가</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
                    <LibraryPickButton classId={classId} articleId={article.id} picked={picked} readers={read} />
                    {picked ? (
                      <Badge tone="green">✓ 학생에게 보이는 중{read > 0 ? ` · 읽은 학생 ${read}명` : ""}</Badge>
                    ) : (
                      <span className="text-[13px] text-grey-500">학생에게 아직 안 보여요</span>
                    )}
                  </div>
                  <h2 className="mt-2 text-[22px] font-bold leading-snug tracking-tight text-grey-900">{article.title}</h2>

                  <div className="mt-4 rounded-2xl bg-grey-50 px-4 py-3 text-[13px] leading-relaxed print:border print:border-grey-200">
                    <p className="font-bold text-grey-800">관련 성취기준 (2022 개정)</p>
                    {standards.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-grey-700">
                        {standards.map((s) => (
                          <li key={s.code}>
                            <b>{s.code}</b> <span className="text-grey-500">{describeStandard(s).replace(` ${s.code}`, "")}</span> {s.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-grey-700">{article.curriculum || "-"}</p>
                    )}
                  </div>

                  <div className="mt-5 space-y-3 text-[16px] leading-[1.85] text-grey-800 print:text-[11pt]">
                    {article.paragraphs.map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                  </div>

                  <p className="mt-5 break-all text-[12px] text-grey-400">
                    출처: {article.origin.site} — {article.origin.title} ({article.origin.url})
                    <br />
                    {sourceNoteOf(article.origin)}
                  </p>
                </article>
              </Card>
            );
          })}
        </div>
      )}
    </TeacherShell>
  );
}
