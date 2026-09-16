"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Badge, Button, Card, ErrorText, Input, ProgressBar, Textarea } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import {
  formatRate,
  formatScore,
  HELP_RATE,
  RECENT_WEEKS,
  type ClassReportStats,
  type DateRange,
  type StudentReport,
  type Tally,
} from "@/lib/report";
import type { StudentComment } from "@/lib/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export interface ReportViewData {
  comments: Record<string, StudentComment>;
  commentsFrom: string | null;
  commentsTo: string | null;
  completedAt: string | null;
  error: string | null;
  /** count: 이번 요청에 넣은 학생 수 */
  pending: { from: string; to: string; requestedAt: string; count: number } | null;
}

const day = (date: string | null) => (date ? formatDate(`${date}T00:00:00+09:00`) : "-");
const rateOf = (t: Tally) => (t.answered ? t.correct / t.answered : null);

function toneOf(ratio: number | null) {
  if (ratio === null) return "text-grey-300";
  if (ratio < HELP_RATE) return "text-danger";
  if (ratio < 0.6) return "text-warning";
  return "text-grey-800";
}

type SortKey =
  | "number"
  | "name"
  | "articles"
  | "quiz"
  | "blank"
  | "synonym"
  | "comprehension"
  | "summary"
  | "content"
  | "ownWords"
  | "sentence"
  | "help";

interface Column {
  key: SortKey;
  label: string;
  value: (s: StudentReport) => number | string | null;
  render?: (s: StudentReport) => ReactNode;
}

const rateCell = (value: number | null) => <span className={cn("font-semibold", toneOf(value))}>{formatRate(value)}</span>;
const pointsCell = (value: number | null, max: number) => (
  <span className={toneOf(value === null ? null : value / max)}>{value === null ? "-" : `${Math.round(value)}/${max}`}</span>
);

const COLUMNS: Column[] = [
  { key: "number", label: "번호", value: (s) => s.number },
  { key: "name", label: "이름", value: (s) => s.name, render: (s) => <b className="text-grey-900">{s.name}</b> },
  { key: "articles", label: "기사", value: (s) => s.articleCount, render: (s) => `${s.articleCount}개` },
  { key: "quiz", label: "퀴즈", value: (s) => s.quiz.rate, render: (s) => rateCell(s.quiz.rate) },
  { key: "blank", label: "빈칸", value: (s) => rateOf(s.quiz.byType.blank), render: (s) => rateCell(rateOf(s.quiz.byType.blank)) },
  {
    key: "synonym",
    label: "비슷한 말",
    value: (s) => rateOf(s.quiz.byType.synonym),
    render: (s) => rateCell(rateOf(s.quiz.byType.synonym)),
  },
  {
    key: "comprehension",
    label: "내용 이해",
    value: (s) => rateOf(s.quiz.byType.comprehension),
    render: (s) => rateCell(rateOf(s.quiz.byType.comprehension)),
  },
  {
    key: "summary",
    label: "요약",
    value: (s) => s.summary.average,
    render: (s) => (
      <span className={cn("font-semibold", toneOf(s.summary.average === null ? null : s.summary.average / 100))}>
        {formatScore(s.summary.average)}
      </span>
    ),
  },
  { key: "content", label: "핵심 내용", value: (s) => s.summary.content, render: (s) => pointsCell(s.summary.content, 50) },
  { key: "ownWords", label: "텍스트 재구성", value: (s) => s.summary.ownWords, render: (s) => pointsCell(s.summary.ownWords, 30) },
  { key: "sentence", label: "문장", value: (s) => s.summary.sentence, render: (s) => pointsCell(s.summary.sentence, 20) },
  {
    key: "help",
    label: `최근 ${RECENT_WEEKS}주`,
    value: (s) => (s.recent.weeks === 0 ? null : s.recent.needsHelp ? 0 : 1),
    render: (s) =>
      s.recent.needsHelp ? (
        <Badge tone="red">도움 필요</Badge>
      ) : s.recent.weeks > 0 ? (
        <span className="text-grey-400">괜찮아요</span>
      ) : (
        <span className="text-grey-300">-</span>
      ),
  },
];

/** 의견을 만든 기간·시각 안내. 기간이 없는 예전 의견은 반 전체로 마지막에 만든 기간으로 본다 */
function commentPeriod(comment: StudentComment | undefined, report: ReportViewData | null) {
  if (!comment) return "";
  const from = comment.from ?? report?.commentsFrom;
  const to = comment.to ?? report?.commentsTo;
  if (!from || !to) return "";
  const at = comment.from ? comment.createdAt : report?.completedAt;
  return `${day(from)} ~ ${day(to)} 기록으로${at ? ` ${formatDateTime(at)}에` : ""} 만든 의견이에요.`;
}

function Checkbox({
  checked,
  indeterminate = false,
  disabled,
  onChange,
  label,
  title,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  title?: string;
}) {
  return (
    <label className={cn("flex items-center", disabled ? "cursor-not-allowed" : "cursor-pointer")} title={title}>
      <input
        type="checkbox"
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="size-[18px] cursor-[inherit] accent-primary disabled:opacity-40"
      />
    </label>
  );
}

function compare(a: number | string | null, b: number | string | null, dir: 1 | -1) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1; // 기록 없음은 항상 아래로
  if (typeof a === "string" || typeof b === "string") return String(a).localeCompare(String(b)) * dir;
  return (a - b) * dir;
}

export function ReportView({
  classId,
  range,
  stats,
  report,
  demo,
  initialStudentId,
}: {
  classId: string;
  range: DateRange;
  stats: ClassReportStats;
  report: ReportViewData | null;
  /** AI 대신 규칙으로 예시 의견을 만드는지 (체험 계정·API 키 없음) */
  demo: boolean;
  /** 처음부터 펼쳐 둘 학생 (반 화면에서 고른 학생) */
  initialStudentId?: string | null;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "number", dir: 1 });
  const [openId, setOpenId] = useState<string | null>(initialStudentId ?? null);
  const [comments, setComments] = useState(report?.comments ?? {});
  // AI 의견을 만들 학생. 기간 안에 기록이 있는 학생만 고를 수 있다
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialStudentId) document.getElementById(`student-${initialStudentId}`)?.scrollIntoView({ block: "center" });
  }, [initialStudentId]);

  const pending = report?.pending ?? null;
  const pickable = stats.students.filter((s) => s.articleCount > 0).map((s) => s.studentId);
  const lastCount = Object.values(report?.comments ?? {}).filter((c) => c.createdAt && c.createdAt === report?.completedAt).length;
  const column = COLUMNS.find((c) => c.key === sort.key)!;
  const rows = [...stats.students].sort(
    (a, b) => compare(column.value(a), column.value(b), sort.dir) || a.number - b.number,
  );

  function applyRange(e: FormEvent) {
    e.preventDefault();
    if (!from || !to) return;
    router.push(`/teacher/classes/${classId}/report?from=${from}&to=${to}`);
  }

  async function generate() {
    const overwrite = picked.filter((id) => comments[id]).length;
    if (
      overwrite > 0 &&
      !window.confirm(`고른 학생 중 ${overwrite}명은 이미 의견이 있어요. 새로 만들면 고친 내용도 새 결과로 바뀌어요. 만들까요?`)
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await apiFetch<{ pending: boolean }>(`/api/classes/${classId}/report/comments`, {
        body: { ...range, studentIds: picked },
      });
      setNotice(
        r.pending
          ? `${picked.length}명의 의견을 요청했어요. 몇 분에서 최대 24시간 뒤에 도착하고, 도착하면 학생용 문장은 바로 학생 화면에 보여요.`
          : `${picked.length}명의 의견을 만들었어요.`,
      );
      setPicked([]);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <Card>
        <form onSubmit={applyRange} className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-grey-600">시작일</span>
            <Input compact type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-grey-600">종료일</span>
            <Input compact type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </label>
          <Button type="submit" variant="grey" className="h-11">
            기간 적용
          </Button>
          <p className="basis-full text-[13px] text-grey-500 sm:ml-auto sm:basis-auto">
            {day(range.from)} ~ {day(range.to)} · 기록이 있는 학생 {stats.activeCount}명
          </p>
        </form>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Metric label="퀴즈 정답률" value={formatRate(stats.quizRate)} />
          <Metric label="요약 평균" value={formatScore(stats.summaryAverage)} />
          <Metric
            label={`도움이 필요한 학생 (최근 ${RECENT_WEEKS}주 ${HELP_RATE * 100}% 미만)`}
            value={`${stats.needsHelpCount}명`}
            danger={stats.needsHelpCount > 0}
          />
        </div>
        {stats.missedWords.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13px] font-semibold text-grey-600">반에서 많이 틀린 낱말</span>
            {stats.missedWords.map((w) => (
              <Badge key={w.word} tone="orange">
                {w.word} {w.count}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-[18px] font-bold">AI 종합 의견</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-grey-600">
              {pending
                ? `${day(pending.from)} ~ ${day(pending.to)} 기간으로 ${pending.count}명의 의견을 만들고 있어요 (${formatDateTime(pending.requestedAt)} 요청). 몇 분에서 최대 24시간 걸려요.`
                : report?.completedAt
                  ? `마지막으로 ${day(report.commentsFrom)} ~ ${day(report.commentsTo)} 기간으로 ${formatDateTime(report.completedAt)}에 ${lastCount > 0 ? `${lastCount}명의 ` : ""}의견을 만들었어요. 학생 이름을 누르면 보고 고칠 수 있어요.`
                  : "학생마다 학생용 격려 문장과 선생님용 지도 메모를 만들어요. 학생용 문장은 도착하면 바로 학생 화면에 보여요."}
            </p>
            {!pending && stats.students.length > 0 && (
              <p className="mt-1 text-[14px] font-medium text-primary">
                {picked.length > 0
                  ? `체크한 ${picked.length}명의 의견만 만들어요. 체크하지 않은 학생의 의견은 그대로 남아요.`
                  : "아래 학생별 결과에서 의견을 만들 학생을 체크해 주세요."}
              </p>
            )}
            {demo && (
              <p className="mt-1 text-[13px] text-grey-400">체험 계정·데모 모드에서는 AI를 부르지 않고 예시 의견을 바로 만들어요.</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {pending && (
              <Button variant="grey" onClick={() => router.refresh()}>
                결과 확인
              </Button>
            )}
            <Button onClick={generate} loading={busy} disabled={Boolean(pending) || picked.length === 0}>
              {day(range.from)} ~ {day(range.to)} 기간으로 {picked.length > 0 && `${picked.length}명 `}만들기
            </Button>
          </div>
        </div>
        {notice && <p className="mt-3 text-[14px] font-medium text-success">{notice}</p>}
        {(error || report?.error) && (
          <div className="mt-3">
            <ErrorText>{error || report?.error}</ErrorText>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="px-5 py-4">
          <h2 className="text-[18px] font-bold">학생별 결과</h2>
          <p className="mt-0.5 text-[13px] text-grey-500">
            체크한 학생만 AI 의견을 만들어요. 제목을 누르면 정렬하고, 학생을 누르면 자세히 봐요.
          </p>
        </div>
        {stats.students.length === 0 ? (
          <p className="mx-5 mb-5 rounded-2xl bg-grey-50 px-4 py-8 text-center text-[14px] text-grey-500">
            아직 반에 학생이 없어요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[14px]">
              <thead>
                <tr className="border-y border-grey-100 bg-grey-50 text-left text-[13px] text-grey-500">
                  <th className="w-10 py-2.5 pl-5 pr-1">
                    <Checkbox
                      checked={pickable.length > 0 && picked.length === pickable.length}
                      indeterminate={picked.length > 0 && picked.length < pickable.length}
                      disabled={pickable.length === 0}
                      onChange={(on) => setPicked(on ? pickable : [])}
                      label="기록이 있는 학생 모두 고르기"
                      title="기록이 있는 학생 모두 고르기"
                    />
                  </th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="px-3 py-2.5 font-medium first:pl-5">
                      <button
                        type="button"
                        onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}
                        className={cn("whitespace-nowrap hover:text-grey-800", sort.key === c.key && "font-semibold text-grey-900")}
                      >
                        {c.label}
                        {sort.key === c.key && (sort.dir === 1 ? " ▲" : " ▼")}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <Fragment key={s.studentId}>
                    <tr
                      id={`student-${s.studentId}`}
                      onClick={() => setOpenId((id) => (id === s.studentId ? null : s.studentId))}
                      className={cn(
                        "cursor-pointer border-b border-grey-100 transition hover:bg-grey-50",
                        openId === s.studentId && "bg-primary-weak/40",
                        s.articleCount === 0 && "text-grey-400",
                      )}
                    >
                      {/* 체크박스를 눌러도 행이 펼쳐지지 않게 한다 */}
                      <td className="py-2.5 pl-5 pr-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={picked.includes(s.studentId)}
                          disabled={s.articleCount === 0}
                          onChange={(on) =>
                            setPicked((prev) => (on ? [...prev, s.studentId] : prev.filter((id) => id !== s.studentId)))
                          }
                          label={`${s.number}번 ${s.name} 고르기`}
                          title={s.articleCount === 0 ? "이 기간에 기록이 없어 의견을 만들 수 없어요" : undefined}
                        />
                      </td>
                      {COLUMNS.map((c) => (
                        <td key={c.key} className="whitespace-nowrap px-3 py-2.5 first:pl-5">
                          {c.render ? c.render(s) : c.value(s)}
                        </td>
                      ))}
                    </tr>
                    {openId === s.studentId && (
                      <tr className="border-b border-grey-100 bg-grey-50/60">
                        <td colSpan={COLUMNS.length + 1} className="px-5 py-5">
                          <StudentDetail
                            classId={classId}
                            student={s}
                            comment={comments[s.studentId]}
                            period={commentPeriod(comments[s.studentId], report)}
                            locked={Boolean(pending)}
                            onSaved={(c) => setComments((prev) => ({ ...prev, [s.studentId]: c }))}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={cn("rounded-2xl px-4 py-3", danger ? "bg-danger-weak" : "bg-grey-50")}>
      <p className="text-[12px] text-grey-500">{label}</p>
      <p className={cn("mt-0.5 text-[22px] font-bold", danger ? "text-danger" : "text-grey-900")}>{value}</p>
    </div>
  );
}

function StudentDetail({
  classId,
  student,
  comment,
  period,
  locked,
  onSaved,
}: {
  classId: string;
  student: StudentReport;
  comment: StudentComment | undefined;
  /** 이 의견을 만든 기간·시각 안내 (없으면 빈 문자열) */
  period: string;
  locked: boolean;
  onSaved: (comment: StudentComment) => void;
}) {
  const [studentMessage, setStudentMessage] = useState(comment?.studentMessage ?? "");
  const [teacherMemo, setTeacherMemo] = useState(comment?.teacherMemo ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const dirty = studentMessage !== (comment?.studentMessage ?? "") || teacherMemo !== (comment?.teacherMemo ?? "");

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const r = await apiFetch<{ comment: StudentComment }>(`/api/classes/${classId}/report/comments`, {
        method: "PATCH",
        body: { studentId: student.studentId, studentMessage, teacherMemo },
      });
      onSaved(r.comment);
      setStatus("저장했어요.");
    } catch (e) {
      setStatus(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <p className="text-[14px] font-bold text-grey-800">
            {student.number}번 {student.name} · 퀴즈 {student.quiz.correct}/{student.quiz.answered}문제 · 요약{" "}
            {student.summary.count}번
          </p>
          {student.recent.weeks > 0 && (
            <p className="mt-0.5 text-[13px] text-grey-500">
              최근 {student.recent.weeks}주: 퀴즈 {formatRate(student.recent.quizRate)} · 요약{" "}
              {formatScore(student.recent.summaryAverage)}
            </p>
          )}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-grey-600">다시 볼 낱말</p>
          {student.quiz.missedWords.length === 0 ? (
            <p className="mt-1 text-[13px] text-grey-400">틀린 낱말이 없어요.</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {student.quiz.missedWords.map((w) => (
                <Badge key={w.word} tone="orange">
                  {w.word}
                  {w.count > 1 && ` ×${w.count}`}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-grey-600">요약 점수 변화</p>
          {student.summary.history.length === 0 ? (
            <p className="mt-1 text-[13px] text-grey-400">이 기간에 낸 요약이 없어요.</p>
          ) : (
            <ul className="mt-1.5 space-y-2">
              {student.summary.history.map((h, i) => (
                <li key={i} className="grid grid-cols-[64px_minmax(0,1fr)_48px] items-center gap-2 text-[13px]">
                  <span className="text-grey-500">{formatDate(h.date)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-grey-700">{h.title}</span>
                    <ProgressBar value={h.score / 100} className="mt-1" />
                  </span>
                  <span className={cn("text-right font-semibold", toneOf(h.score / 100))}>{h.score}점</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {period && <p className="text-[13px] text-grey-500">{period}</p>}
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-grey-600">학생용 문장 · 학생 화면에 보여요</span>
          <Textarea
            compact
            rows={3}
            value={studentMessage}
            onChange={(e) => setStudentMessage(e.target.value)}
            disabled={locked}
            placeholder="아직 AI 의견이 없어요. 직접 써도 돼요."
            className="bg-white"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-grey-600">교사용 메모 · 선생님만 봐요</span>
          <Textarea
            compact
            rows={3}
            value={teacherMemo}
            onChange={(e) => setTeacherMemo(e.target.value)}
            disabled={locked}
            className="bg-white"
          />
        </label>
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={saving} disabled={!dirty || locked}>
            저장
          </Button>
          <span className="text-[13px] text-grey-500">
            {locked ? "AI 의견을 만드는 중에는 고칠 수 없어요." : status}
          </span>
        </div>
      </div>
    </div>
  );
}
