import Link from "next/link";
import { buttonClass, Card, ChevronRight } from "@/components/ui";
import { formatRate, formatScore, HELP_RATE, RECENT_WEEKS, type ClassReportStats } from "@/lib/report";
import type { ClassReport } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/** 반 화면 오른쪽: 최근 4주 결과 요약과 결과 분석표로 가는 버튼 */
export function ReportSummaryCard({
  classId,
  stats,
  report,
}: {
  classId: string;
  stats: ClassReportStats;
  report: ClassReport | null;
}) {
  const helpers = stats.students.filter((s) => s.recent.needsHelp);

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] font-bold">결과 분석표</h2>
        <span className="text-[13px] text-grey-500">최근 4주 · 기록 {stats.activeCount}명</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-grey-50 px-4 py-3">
          <dt className="text-[12px] text-grey-500">퀴즈 정답률</dt>
          <dd className="mt-0.5 text-[20px] font-bold text-grey-900">{formatRate(stats.quizRate)}</dd>
        </div>
        <div className="rounded-2xl bg-grey-50 px-4 py-3">
          <dt className="text-[12px] text-grey-500">요약 평균</dt>
          <dd className="mt-0.5 text-[20px] font-bold text-grey-900">{formatScore(stats.summaryAverage)}</dd>
        </div>
      </dl>

      <div className={cn("mt-2 rounded-2xl px-4 py-3", helpers.length > 0 ? "bg-danger-weak" : "bg-grey-50")}>
        <p className={cn("text-[14px] font-semibold", helpers.length > 0 ? "text-danger" : "text-grey-700")}>
          도움이 필요한 학생 {helpers.length}명
        </p>
        {helpers.length > 0 && (
          <p className="mt-0.5 line-clamp-2 text-[13px] text-grey-700">
            {helpers.map((s) => `${s.number}번 ${s.name}`).join(", ")}
          </p>
        )}
        <p className="mt-1 text-[12px] text-grey-500">
          최근 {RECENT_WEEKS}주 퀴즈 정답률이나 요약 평균이 {HELP_RATE * 100}% 미만
        </p>
      </div>

      <p className="mt-3 text-[13px] text-grey-500">
        {report?.pending
          ? "AI 의견을 만들고 있어요"
          : report?.completedAt
            ? `AI 의견: ${formatDate(report.completedAt)}에 만들었어요`
            : "AI 의견을 아직 만들지 않았어요"}
      </p>
      <Link href={`/teacher/classes/${classId}/report`} className={buttonClass("secondary", "md", "mt-3 w-full")}>
        분석표 열기
        <ChevronRight className="size-4" />
      </Link>
    </Card>
  );
}
