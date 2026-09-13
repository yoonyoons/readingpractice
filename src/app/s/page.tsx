import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { Badge, CheckIcon, ChevronRight, EmptyState, ProgressBar } from "@/components/ui";
import { getDb } from "@/lib/db";
import { getStudentSession } from "@/lib/session";
import type { Article, Submission, Worksheet } from "@/lib/types";
import { cn, formatDate, latestSummary } from "@/lib/utils";

function progressOf(article: Article, sub: Submission | undefined) {
  const read = Boolean(sub?.readAt);
  const quiz = read && article.quiz.every((q) => sub?.quizAnswers[q.id]);
  const summary = latestSummary(sub);
  return { read, quiz, summary, done: Boolean(summary) };
}

export default async function StudentHome() {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const { student, classRoom } = session;

  const db = getDb();
  const [worksheets, submissions] = await Promise.all([
    db.listWorksheets(classRoom.id),
    db.listSubmissionsByStudent(student.id),
  ]);
  const published = worksheets
    .filter((w) => w.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const subMap = new Map(submissions.map((s) => [`${s.worksheetId}:${s.articleId}`, s]));
  const [current, ...past] = published;

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-grey-50 pb-12">
      <header className="flex h-14 items-center justify-between bg-white px-5">
        <span className="text-[15px] font-semibold text-grey-700">{classRoom.name}</span>
        <LogoutButton role="student" />
      </header>

      <section className="bg-white px-5 pb-7 pt-4">
        <h1 className="text-[24px] font-bold leading-snug tracking-tight">
          {student.name} 학생,
          <br />
          {current ? "이번 주 뉴스를 읽어 볼까요?" : "반가워요!"}
        </h1>
      </section>

      {!current ? (
        <div className="mx-5 mt-3 rounded-3xl bg-white">
          <EmptyState
            icon="📭"
            title="아직 학습지가 없어요"
            description="선생님이 이번 주 학습지를 내주면 여기에 나타나요."
          />
        </div>
      ) : (
        <WorksheetSection worksheet={current} subMap={subMap} highlight />
      )}

      {past.length > 0 && (
        <section className="mt-8 px-5">
          <h2 className="mb-3 text-[17px] font-bold text-grey-800">지난 학습지</h2>
          <div className="space-y-3">
            {past.map((w) => (
              <details key={w.id} className="group rounded-3xl bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
                  <span>
                    <span className="block text-[16px] font-semibold text-grey-800">{w.title}</span>
                    <span className="text-[13px] text-grey-500">{formatDate(w.publishedAt)}</span>
                  </span>
                  <ChevronRight className="size-5 text-grey-400 transition group-open:rotate-90" />
                </summary>
                <div className="px-3 pb-3">
                  <ArticleList worksheet={w} subMap={subMap} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function WorksheetSection({
  worksheet,
  subMap,
}: {
  worksheet: Worksheet;
  subMap: Map<string, Submission>;
  highlight?: boolean;
}) {
  const articles = worksheet.articles.filter((a) => a.status === "ready");
  const doneCount = articles.filter((a) => progressOf(a, subMap.get(`${worksheet.id}:${a.id}`)).done).length;

  return (
    <section className="mt-3 px-5">
      <div className="rounded-3xl bg-white p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] font-medium text-grey-500">{formatDate(worksheet.publishedAt)} 배포</p>
            <h2 className="mt-0.5 text-[18px] font-bold text-grey-900">{worksheet.title}</h2>
          </div>
          <span className="text-[14px] font-semibold text-primary">
            {doneCount}/{articles.length} 완료
          </span>
        </div>
        <ProgressBar value={articles.length ? doneCount / articles.length : 0} className="mt-4" />
        {doneCount === articles.length && articles.length > 0 && (
          <p className="mt-3 text-[14px] font-medium text-success">이번 주 학습을 모두 마쳤어요! 🎉</p>
        )}
      </div>
      <div className="mt-3">
        <ArticleList worksheet={worksheet} subMap={subMap} />
      </div>
    </section>
  );
}

function ArticleList({ worksheet, subMap }: { worksheet: Worksheet; subMap: Map<string, Submission> }) {
  const articles = worksheet.articles.filter((a) => a.status === "ready");
  return (
    <ul className="space-y-3">
      {articles.map((article, i) => {
        const p = progressOf(article, subMap.get(`${worksheet.id}:${article.id}`));
        const status = p.done
          ? `요약 ${p.summary?.feedback.score}점`
          : p.quiz
            ? "요약할 차례예요"
            : p.read
              ? "퀴즈 풀 차례예요"
              : "아직 읽지 않았어요";
        return (
          <li key={article.id}>
            <Link
              href={`/s/${worksheet.id}/${article.id}`}
              className="block rounded-3xl border border-grey-100 bg-white p-5 transition hover:border-grey-200 active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <Badge tone="blue">
                  {i + 1}. {article.topic}
                </Badge>
              </div>
              <p className="mt-2.5 text-[17px] font-bold leading-snug text-grey-900">{article.title}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {[
                    { label: "읽기", ok: p.read },
                    { label: "퀴즈", ok: p.quiz },
                    { label: "요약", ok: p.done },
                  ].map((s) => (
                    <span
                      key={s.label}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                        s.ok ? "bg-primary-weak text-primary" : "bg-grey-100 text-grey-400",
                      )}
                    >
                      {s.ok && <CheckIcon className="size-3" />}
                      {s.label}
                    </span>
                  ))}
                </div>
                <span className={cn("text-[13px] font-semibold", p.done ? "text-success" : "text-grey-500")}>
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
