import { Badge, ProgressBar } from "@/components/ui";
import { formatRate, formatScore, type StudentReport } from "@/lib/report";
import type { QuizType } from "@/lib/types";
import { QUIZ_TYPE_LABEL } from "@/lib/utils";

/** 학생 홈: 지금까지 푼 퀴즈·요약을 모은 내 학습 분석과 AI 응원 한마디 */
export function MyReport({ report, message }: { report: StudentReport; message: string }) {
  if (report.articleCount === 0) return null;
  const types = (Object.keys(report.quiz.byType) as QuizType[]).filter((t) => report.quiz.byType[t].answered > 0);
  const areas = [
    { label: "핵심 내용", value: report.summary.content, max: 50 },
    { label: "텍스트 재구성", value: report.summary.ownWords, max: 30 },
    { label: "문장 완성도", value: report.summary.sentence, max: 20 },
  ];

  return (
    <section className="mt-8 px-5 md:px-0">
      <h2 className="mb-3 text-[17px] font-bold text-grey-800">내 학습 분석</h2>

      {message && (
        <div className="mb-3 rounded-3xl bg-primary-weak p-5 md:p-6">
          <p className="text-[13px] font-semibold text-primary">AI가 쓴 응원 한마디</p>
          <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-grey-800">{message}</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 md:p-6">
          <p className="text-[14px] font-semibold text-grey-500">퀴즈</p>
          <p className="mt-1 text-[28px] font-bold tracking-tight text-grey-900">
            {formatRate(report.quiz.rate)}
            <span className="ml-1.5 text-[14px] font-medium text-grey-500">
              {report.quiz.answered}문제 중 {report.quiz.correct}개 정답
            </span>
          </p>
          <ul className="mt-4 space-y-3">
            {types.map((t) => {
              const tally = report.quiz.byType[t];
              return (
                <li key={t}>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-grey-700">{QUIZ_TYPE_LABEL[t]}</span>
                    <span className="font-semibold text-grey-800">{formatRate(tally.correct / tally.answered)}</span>
                  </div>
                  <ProgressBar value={tally.correct / tally.answered} className="mt-1" />
                </li>
              );
            })}
          </ul>
          {report.quiz.missedWords.length > 0 && (
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-grey-600">다시 볼 낱말</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {report.quiz.missedWords.map((w) => (
                  <Badge key={w.word} tone="orange">
                    {w.word}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white p-5 md:p-6">
          <p className="text-[14px] font-semibold text-grey-500">요약</p>
          {report.summary.count === 0 ? (
            <p className="mt-2 text-[14px] text-grey-500">아직 낸 요약이 없어요.</p>
          ) : (
            <>
              <p className="mt-1 text-[28px] font-bold tracking-tight text-grey-900">
                {formatScore(report.summary.average)}
                <span className="ml-1.5 text-[14px] font-medium text-grey-500">{report.summary.count}번 평균</span>
              </p>
              <ul className="mt-4 space-y-3">
                {areas.map((a) => (
                  <li key={a.label}>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-grey-700">{a.label}</span>
                      <span className="font-semibold text-grey-800">
                        {a.value === null ? "-" : Math.round(a.value)}/{a.max}
                      </span>
                    </div>
                    <ProgressBar value={a.value === null ? 0 : a.value / a.max} className="mt-1" />
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[13px] text-grey-600">
                점수 변화{" "}
                <b className="text-grey-800">
                  {report.summary.history
                    .slice(-6)
                    .map((h) => h.score)
                    .join(" → ")}
                </b>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
