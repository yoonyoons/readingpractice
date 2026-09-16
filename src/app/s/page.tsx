import Link from "next/link";
import { redirect } from "next/navigation";
import { Byline } from "@/components/Byline";
import { LogoutButton } from "@/components/LogoutButton";
import { MyReport } from "@/components/student/MyReport";
import { Badge, CheckIcon, ChevronRight, EmptyState, ProgressBar } from "@/components/ui";
import { getDb } from "@/lib/db";
import { buildStudentReport } from "@/lib/report";
import { loadClassReport } from "@/lib/report-ai";
import { getStudentSession } from "@/lib/session";
import type { Article, Submission, Worksheet } from "@/lib/types";
import { cn, formatDate, hasOpinionStep, isArticleDone, latestSummary } from "@/lib/utils";

function progressOf(article: Article, sub: Submission | undefined) {
  const read = Boolean(sub?.readAt);
  const quiz = read && article.quiz.every((q) => sub?.quizAnswers[q.id]);
  const summary = latestSummary(sub);
  return {
    read,
    quiz,
    summary,
    needsOpinion: hasOpinionStep(article),
    opinion: Boolean(sub?.opinion),
    done: isArticleDone(article, sub),
  };
}

export default async function StudentHome() {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const { student, classRoom } = session;

  const db = getDb();
  const [worksheets, submissions, classReport] = await Promise.all([
    db.listWorksheets(classRoom.id),
    db.listSubmissionsByStudent(student.id),
    // 만드는 중인 AI 의견이 도착했으면 가져온다 (1분에 한 번만 확인)
    loadClassReport(classRoom.id, true),
  ]);
  const published = worksheets
    .filter((w) => w.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const subMap = new Map(submissions.map((s) => [`${s.worksheetId}:${s.articleId}`, s]));
  const [current, ...past] = published;

  return (
    // 휴대폰: 세로 한 단, 태블릿 이상: 넓은 컨테이너에 카드형 배치
    <main className="mx-auto min-h-dvh w-full max-w-md bg-grey-50 pb-12 md:max-w-3xl md:px-6 lg:max-w-5xl lg:px-8">
      <div className="bg-white md:mt-6 md:rounded-3xl">
        <header className="flex h-14 items-center justify-between px-5 md:px-8">
          <span className="text-[15px] font-semibold text-grey-700">{classRoom.name}</span>
          <LogoutButton role="student" />
        </header>

        <section className="px-5 pb-7 pt-4 md:px-8 md:pb-8 md:pt-2">
          <h1 className="text-[24px] font-bold leading-snug tracking-tight md:text-[28px]">
            {student.name} 학생,
            <br />
            {current ? "이번 주 뉴스를 읽어 볼까요?" : "반가워요!"}
          </h1>
        </section>
      </div>

      {!current ? (
        <div className="mx-5 mt-3 rounded-3xl bg-white md:mx-0">
          <EmptyState
            icon="📭"
            title="아직 학습지가 없어요"
            description="선생님이 이번 주 학습지를 내주면 여기에 나타나요."
          />
        </div>
      ) : (
        <WorksheetSection worksheet={current} subMap={subMap} />
      )}

      <MyReport
        report={buildStudentReport(student, worksheets, submissions, null)}
        message={classReport?.comments[student.id]?.studentMessage ?? ""}
      />

      {past.length > 0 && (
        <section className="mt-8 px-5 md:px-0">
          <h2 className="mb-3 text-[17px] font-bold text-grey-800">지난 학습지</h2>
          <div className="space-y-3">
            {past.map((w) => (
              <details key={w.id} className="group rounded-3xl bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 md:px-6">
                  <span>
                    <span className="block text-[16px] font-semibold text-grey-800">{w.title}</span>
                    <span className="text-[13px] text-grey-500">{formatDate(w.publishedAt)}</span>
                  </span>
                  <ChevronRight className="size-5 text-grey-400 transition group-open:rotate-90" />
                </summary>
                <div className="px-3 pb-3 md:px-4 md:pb-4">
                  <ArticleList worksheet={w} subMap={subMap} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-center text-[13px] text-grey-400">
        기사·퀴즈·채점에 AI(Claude)를 사용해요 ·{" "}
        <Link href="/policy" className="underline underline-offset-2">
          운영 정책
        </Link>{" "}
        · <Byline />
      </p>
    </main>
  );
}

function WorksheetSection({ worksheet, subMap }: { worksheet: Worksheet; subMap: Map<string, Submission> }) {
  const articles = worksheet.articles.filter((a) => a.status === "ready");
  const doneCount = articles.filter((a) => progressOf(a, subMap.get(`${worksheet.id}:${a.id}`)).done).length;

  return (
    // 태블릿 가로: 왼쪽에 진행 상황 카드를 고정하고 오른쪽에 기사 카드
    <section className="mt-3 px-5 md:px-0 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-5">
      <div className="rounded-3xl bg-white p-5 md:p-6 lg:sticky lg:top-6">
        <div className="flex items-end justify-between lg:flex-col lg:items-start lg:gap-3">
          <div>
            <p className="text-[13px] font-medium text-grey-500">{formatDate(worksheet.publishedAt)} 배포</p>
            <h2 className="mt-0.5 text-[18px] font-bold text-grey-900 md:text-[20px]">{worksheet.title}</h2>
          </div>
          <span className="text-[14px] font-semibold text-primary lg:text-[22px]">
            {doneCount}/{articles.length} 완료
          </span>
        </div>
        <ProgressBar value={articles.length ? doneCount / articles.length : 0} className="mt-4" />
        {doneCount === articles.length && articles.length > 0 && (
          <p className="mt-3 text-[14px] font-medium text-success">이번 주 학습을 모두 마쳤어요! 🎉</p>
        )}
      </div>
      <div className="mt-3 lg:mt-0">
        <ArticleList worksheet={worksheet} subMap={subMap} />
      </div>
    </section>
  );
}

function ArticleList({ worksheet, subMap }: { worksheet: Worksheet; subMap: Map<string, Submission> }) {
  const articles = worksheet.articles.filter((a) => a.status === "ready");
  return (
    // 태블릿 이상에서는 기사 카드를 두 열로
    <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
      {articles.map((article, i) => {
        const p = progressOf(article, subMap.get(`${worksheet.id}:${article.id}`));
        const status = p.done
          ? `요약 ${p.summary?.feedback.score}점`
          : p.summary
            ? "생각 나눌 차례예요"
            : p.quiz
              ? "요약할 차례예요"
              : p.read
                ? "퀴즈 풀 차례예요"
                : "아직 읽지 않았어요";
        const steps = [
          { label: "읽기", ok: p.read },
          { label: "퀴즈", ok: p.quiz },
          { label: "요약", ok: Boolean(p.summary) },
          ...(p.needsOpinion ? [{ label: "생각", ok: p.opinion }] : []),
        ];
        return (
          <li key={article.id} className="md:flex">
            <Link
              href={`/s/${worksheet.id}/${article.id}`}
              className="flex w-full flex-col rounded-3xl border border-grey-100 bg-white p-5 transition hover:border-grey-200 active:scale-[0.99] md:p-6"
            >
              <div>
                <Badge tone="blue">
                  {i + 1}. {article.topic}
                </Badge>
              </div>
              <p className="mt-2.5 text-[17px] font-bold leading-snug text-grey-900 md:text-[18px]">{article.title}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 md:mt-auto md:pt-5">
                <div className="flex items-center gap-1">
                  {steps.map((s) => (
                    <span
                      key={s.label}
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[12px] font-semibold",
                        s.ok ? "bg-primary-weak text-primary" : "bg-grey-100 text-grey-400",
                      )}
                    >
                      {s.ok && <CheckIcon className="size-3" />}
                      {s.label}
                    </span>
                  ))}
                </div>
                <span className={cn("shrink-0 text-[13px] font-semibold", p.done ? "text-success" : "text-grey-500")}>
                  {status}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
