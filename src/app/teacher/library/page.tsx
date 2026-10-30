import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/teacher/PrintButton";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { Badge, Card, ChevronLeft, EmptyState } from "@/components/ui";
import { CURRICULUM_STANDARDS, describeStandard } from "@/lib/curriculum-standards";
import { GRADES } from "@/lib/grades";
import { LIBRARY_FIELDS, listLibraryArticles } from "@/lib/library";
import { getTeacher } from "@/lib/session";
import { formatDate } from "@/lib/utils";

const STANDARD_BY_CODE = new Map(CURRICULUM_STANDARDS.map((s) => [s.code, s]));

/** 자동 기사는 고른 성취기준을 "초5~6 과학 '영역' [6과05-01], ..." 꼴로 적어 두므로 코드를 다시 찾아 문장을 붙인다 */
function standardsOf(curriculum: string) {
  const codes = curriculum.match(/\[[^\]]+\]/g) ?? [];
  return codes.flatMap((code) => STANDARD_BY_CODE.get(code) ?? []);
}

/** 서버가 매주 자동으로 추가한 관심 분야 기사의 전문. 브라우저 인쇄로 PDF로 저장할 수 있다 */
export default async function LibraryArticlesPage() {
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");

  // 목록은 오래된 것부터라 번호가 새 기사가 늘어도 바뀌지 않는다
  const articles = (await listLibraryArticles()).filter((a) => a.addedBy === "auto");

  return (
    <TeacherShell teacher={teacher}>
      <div className="print:hidden">
        <Link href="/teacher" className="inline-flex items-center gap-1 text-[14px] font-medium text-grey-500 hover:text-grey-800">
          <ChevronLeft className="size-4" />
          우리 반
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">📚 관심 분야 자동 추가 기사</h1>
            <p className="mt-1 text-[14px] text-grey-500">
              서버가 매주 분야별로 추가한 기사 {articles.length}편의 전문과 관련 성취기준이에요. 인쇄 창에서 &lsquo;PDF로 저장&rsquo;을 고르면 파일로 받을 수 있어요.
            </p>
          </div>
          {articles.length > 0 && <PrintButton />}
        </div>
      </div>

      <h1 className="hidden text-[20pt] font-bold print:block">관심 분야 자동 추가 기사 전문 ({articles.length}편)</h1>

      {articles.length === 0 ? (
        <Card className="mt-6">
          <EmptyState icon="🗂️" title="아직 자동으로 추가된 기사가 없어요" description="서버가 매주 분야별로 새 기사를 추가하면 여기에 모여요." />
        </Card>
      ) : (
        <div className="mt-6 space-y-5 print:mt-4 print:space-y-0">
          {articles.map((article, i) => {
            const standards = standardsOf(article.curriculum);
            const field = LIBRARY_FIELDS[article.field];
            return (
              <Card key={article.id} className="print:break-before-page print:rounded-none print:p-0 print:first:break-before-auto">
                <article>
                  <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-grey-500">
                    <span className="font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                    <Badge tone="blue">
                      {field.emoji} {field.label}
                    </Badge>
                    {article.gradeLevels.map((g) => (
                      <Badge key={g}>{GRADES[g].label}</Badge>
                    ))}
                    <span>· 키워드 「{article.keyword}」 · {formatDate(article.createdAt)} 추가</span>
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
