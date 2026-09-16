"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge, Button, buttonClass, Card, ChevronRight, ErrorText } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import {
  formatRate,
  formatScore,
  HELP_RATE,
  TREND_WEEKS,
  WEAK_RATE,
  weakAreas,
  type ClassReportStats,
  type DateRange,
  type StudentReport,
  type WordCount,
} from "@/lib/report";
import { cn, formatDate } from "@/lib/utils";

export interface RosterStudent {
  id: string;
  number: number;
  name: string;
  hasPin: boolean;
}

const QUIZ_COLOR = "#3182f6";
const SUMMARY_COLOR = "#e8710a";
const ROW_GRID = "grid grid-cols-[20px_minmax(0,1fr)_56px_40px_36px] items-center gap-2";

const day = (date: string) => formatDate(`${date}T00:00:00+09:00`);
/** 주 시작 월요일(YYYY-MM-DD)을 "9/8"로 */
const shortWeek = (week: string) => `${Number(week.slice(5, 7))}/${Number(week.slice(8, 10))}`;

function toneOf(ratio: number | null) {
  if (ratio === null) return "text-grey-300";
  return ratio < HELP_RATE ? "text-danger" : "text-grey-800";
}

/** 주마다 0~100으로 맞춘 퀴즈 정답률과 요약 점수. 기록이 없는 주는 null */
interface WeekPoint {
  week: string;
  quiz: number | null;
  summary: number | null;
}

function trendOf(report: StudentReport | undefined, weeks: string[]): WeekPoint[] {
  const byWeek = new Map((report?.weekly ?? []).map((w) => [w.week, w]));
  return weeks.map((week) => {
    const rate = byWeek.get(week)?.quizRate ?? null;
    return { week, quiz: rate === null ? null : rate * 100, summary: byWeek.get(week)?.summaryAverage ?? null };
  });
}

/** 기록이 없는 주에서 끊기는 꺾은선 */
function linePath(values: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  let d = "";
  let drawing = false;
  values.forEach((v, i) => {
    if (v === null) {
      drawing = false;
      return;
    }
    d += `${drawing ? "L" : "M"}${x(i)} ${y(v)} `;
    drawing = true;
  });
  return d.trim();
}

/**
 * 반 화면 본문 2열. 왼쪽은 children(학습지) 아래에 반 결과 분석표, 오른쪽은 aside(반 코드) 아래에 학생 목록.
 * 오른쪽 목록에서 학생을 누르면 그 학생 행 바로 아래에 상세 분석이 펼쳐진다 (한 번에 한 명).
 * 한 열로 쌓이는 좁은 화면에서는 학생 목록이 분석표보다 먼저 오도록 order로 순서를 바꾼다.
 */
export function ClassInsights({
  classId,
  students,
  stats,
  weeks,
  range,
  report,
  aside,
  children,
}: {
  classId: string;
  students: RosterStudent[];
  stats: ClassReportStats;
  /** 성적 추이에 쓸 주 (월요일 날짜, 오래된 주부터) */
  weeks: string[];
  range: DateRange;
  report: { pending: boolean; completedAt: string | null };
  aside: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reports = new Map(stats.students.map((s) => [s.studentId, s]));
  // 삭제되어 목록에서 사라진 학생은 선택이 풀린 것으로 본다
  const selected = students.find((s) => s.id === selectedStudentId) ?? null;
  const managing = manageMode && students.length > 0;

  async function act(student: RosterStudent, action: "reset" | "delete") {
    const label = `${student.number}번 ${student.name}`;
    const ok = window.confirm(
      action === "reset"
        ? `${label} 학생의 PIN을 초기화할까요?\n학생이 다음에 입장할 때 입력하는 숫자가 새 PIN이 돼요.`
        : `${label} 학생을 삭제할까요?\n이 학생의 학습 기록도 함께 지워져요.`,
    );
    if (!ok) return;
    setBusy(student.id);
    setError("");
    try {
      await apiFetch(
        `/api/classes/${classId}/students/${student.id}`,
        action === "reset" ? { method: "PATCH", body: { action: "reset-pin" } } : { method: "DELETE" },
      );
      if (action === "delete" && student.id === selectedStudentId) setSelectedStudentId(null);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const reportHref = `/teacher/classes/${classId}/report?from=${range.from}&to=${range.to}${selected ? `&student=${selected.id}` : ""}`;

  return (
    <div className="mt-6 flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="contents lg:block lg:space-y-5">
        <div className="order-1 space-y-5">{children}</div>

        <Card className="order-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h2 className="text-[18px] font-bold">
              반 결과 분석표 <span className="text-grey-500">(최근 {TREND_WEEKS}주)</span>
            </h2>
            <p className="text-[13px] text-grey-500">
              {day(range.from)} ~ {day(range.to)} · 기록 {stats.activeCount}명
            </p>
          </div>

          <p className="mt-4 text-[14px] font-bold text-grey-700">반 평균</p>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            <Metric accent label="퀴즈 정답률" value={formatRate(stats.quizRate)} />
            <Metric accent label="요약 평균" value={formatScore(stats.summaryAverage)} />
          </dl>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-grey-500">
              {report.pending
                ? "AI 의견을 만들고 있어요"
                : report.completedAt
                  ? `AI 의견: ${formatDate(report.completedAt)}에 만들었어요`
                  : "AI 의견을 아직 만들지 않았어요"}
            </p>
            <Link href={reportHref} className={buttonClass("primary", "md", "shrink-0")}>
              상세 분석 페이지로 이동
              <ChevronRight className="size-5" />
            </Link>
          </div>
        </Card>
      </div>

      <div className="contents lg:block lg:space-y-5">
        <div className="order-2">{aside}</div>

        <Card className="order-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[18px] font-bold">
              학생 및 성취도 <span className="text-grey-500">({students.length}명)</span>
            </h2>
            {students.length > 0 && (
              <Button variant={managing ? "secondary" : "grey"} size="sm" onClick={() => setManageMode((m) => !m)} aria-pressed={managing}>
                {managing ? "완료" : "PIN 초기화·삭제"}
              </Button>
            )}
          </div>

          {students.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-grey-50 px-4 py-8 text-center text-[14px] leading-relaxed text-grey-500">
              학생이 반 코드로 입장하면
              <br />
              여기에 나타나요.
            </p>
          ) : managing ? (
            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
              <ul className="space-y-1">
                {students.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 px-2.5 py-1.5">
                    <span className="w-5 shrink-0 text-right text-[13px] font-medium text-grey-400">{s.number}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-grey-800">
                      {s.name}
                      {!s.hasPin && <span className="ml-1.5 text-[12px] font-medium text-warning">PIN 초기화됨</span>}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => act(s, "reset")} disabled={busy === s.id}>
                      PIN 초기화
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => act(s, "delete")} disabled={busy === s.id} className="text-danger">
                      삭제
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className={cn(ROW_GRID, "mt-4 border border-transparent px-2.5 text-[12px] text-grey-400")}>
                <span />
                <span>이름</span>
                <span className="text-center">퀴즈 추이</span>
                <span className="text-right">퀴즈</span>
                <span className="text-right">요약</span>
              </div>
              <ul className="mt-1 space-y-1">
                {students.map((s) => {
                  const r = reports.get(s.id);
                  const active = s.id === selected?.id;
                  const quizRate = r?.quiz.rate ?? null;
                  const summary = r?.summary.average ?? null;
                  return (
                    <li key={s.id} className={cn("rounded-2xl", active && "bg-primary-weak")}>
                      <button
                        type="button"
                        aria-expanded={active}
                        onClick={() => setSelectedStudentId(active ? null : s.id)}
                        className={cn(
                          ROW_GRID,
                          "w-full rounded-2xl border border-transparent px-2.5 py-2 text-left transition",
                          !active && "hover:bg-grey-50",
                        )}
                      >
                        <span className="text-right text-[13px] font-medium text-grey-400">{s.number}</span>
                        <span className="truncate text-[15px] font-semibold text-grey-800">{s.name}</span>
                        <Sparkline values={trendOf(r, weeks).map((p) => p.quiz)} />
                        <span className={cn("text-right text-[14px] font-semibold tabular-nums", toneOf(quizRate))}>
                          {formatRate(quizRate)}
                        </span>
                        <span className={cn("text-right text-[14px] font-semibold tabular-nums", toneOf(summary === null ? null : summary / 100))}>
                          {summary === null ? "-" : Math.round(summary)}
                        </span>
                      </button>
                      {active && <StudentDetail student={s} report={r} weeks={weeks} />}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl px-4 py-3", accent ? "bg-primary-weak" : "border border-grey-100 bg-white")}>
      <dt className="text-[12px] text-grey-600">{label}</dt>
      <dd className="mt-0.5 text-[22px] font-bold tabular-nums text-grey-900">{value}</dd>
    </div>
  );
}

/** 학생 목록에서 누른 학생 행 아래에 펼쳐지는 상세 분석 (행과 같은 파란 바탕 안) */
function StudentDetail({ student, report, weeks }: { student: RosterStudent; report: StudentReport | undefined; weeks: string[] }) {
  const areas = report ? weakAreas(report) : [];
  const words = report?.quiz.missedWords ?? [];
  const hasRecord = Boolean(report && report.articleCount > 0);

  return (
    <div className="animate-fade-up space-y-2 px-2 pb-3">
      {!student.hasPin && (
        <div className="px-1">
          <Badge tone="orange">PIN 초기화됨</Badge>
        </div>
      )}

      <TrendChart points={trendOf(report, weeks)} />

      <dl className="grid grid-cols-2 gap-2">
        <Metric label="퀴즈 평균" value={formatRate(report?.quiz.rate ?? null)} />
        <Metric label="요약 평균" value={formatScore(report?.summary.average ?? null)} />
      </dl>

      <div className="px-2 pt-2">
        <p className="text-[13px] font-semibold text-grey-700">
          취약 영역 <span className="font-normal text-grey-500">({WEAK_RATE * 100}% 미만)</span>
        </p>
        {!hasRecord ? (
          <p className="mt-1 text-[13px] text-grey-500">최근 {TREND_WEEKS}주 기록이 없어 아직 분석할 수 없어요.</p>
        ) : areas.length === 0 ? (
          <p className="mt-1 text-[13px] text-grey-500">{WEAK_RATE * 100}% 미만인 영역이 없어요.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {areas.map((a) => (
              <li key={a.label} className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="text-grey-800">{a.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-danger">{a.detail}</span>
              </li>
            ))}
          </ul>
        )}
        {words.length > 0 && (
          <div className="mt-3">
            <p className="text-[12px] font-semibold text-grey-600">많이 틀린 낱말</p>
            <WordCloud words={words} />
          </div>
        )}
      </div>
    </div>
  );
}

/** 많이 틀린 낱말일수록 크고 진하게. 가장 많이 틀린 낱말이 가운데 오도록 좌우로 번갈아 놓는다 */
function WordCloud({ words }: { words: WordCount[] }) {
  const max = Math.max(...words.map((w) => w.count));
  const min = Math.min(...words.map((w) => w.count));
  const arranged: WordCount[] = [];
  words.forEach((w, i) => (i % 2 === 0 ? arranged.push(w) : arranged.unshift(w)));

  return (
    <ul className="mt-2 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 px-1 py-2 leading-tight">
      {arranged.map((w) => {
        const weight = max === min ? 0.5 : (w.count - min) / (max - min);
        return (
          <li
            key={w.word}
            title={`${w.count}번 틀렸어요`}
            className={cn(weight >= 1 ? "font-bold text-primary" : weight >= 0.5 ? "font-semibold text-grey-800" : "font-medium text-grey-600")}
            style={{ fontSize: `${Math.round(13 + weight * 9)}px` }}
          >
            {w.word}
            <span className="sr-only"> {w.count}번</span>
          </li>
        );
      })}
    </ul>
  );
}

/** 학생 행의 퀴즈 정답률 미니 그래프 (0~100) */
function Sparkline({ values }: { values: (number | null)[] }) {
  const w = 56;
  const h = 22;
  const pad = 3;
  const x = (i: number) => pad + (values.length > 1 ? (i * (w - pad * 2)) / (values.length - 1) : (w - pad * 2) / 2);
  const y = (v: number) => pad + (1 - v / 100) * (h - pad * 2);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      {values.some((v) => v !== null) ? (
        <>
          <path d={linePath(values, x, y)} fill="none" stroke={QUIZ_COLOR} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          {values.map((v, i) => v !== null && <circle key={i} cx={x(i)} cy={y(v)} r={2} fill={QUIZ_COLOR} />)}
        </>
      ) : (
        <line x1={pad} x2={w - pad} y1={h / 2} y2={h / 2} stroke="#d1d6db" strokeWidth={1.5} strokeDasharray="2 3" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** 선택한 학생의 주별 퀴즈 정답률·요약 점수 꺾은선 (둘 다 0~100이라 축 하나) */
function TrendChart({ points }: { points: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 280;
  const H = 140;
  const left = 28;
  const right = 14;
  const top = 10;
  const bottom = 24;
  const n = points.length;
  const step = n > 1 ? (W - left - right) / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? left + i * step : (left + W - right) / 2);
  const y = (v: number) => top + (1 - v / 100) * (H - top - bottom);
  const label = (i: number) => (i === n - 1 ? "이번 주" : shortWeek(points[i].week));
  const percent = (v: number | null) => (v === null ? "-" : `${Math.round(v)}%`);

  // 마우스를 올린 주, 아니면 기록이 있는 마지막 주
  const latest = points.reduce((last, p, i) => (p.quiz !== null || p.summary !== null ? i : last), -1);
  if (latest < 0) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-2xl border border-dashed border-grey-200 text-[13px] text-grey-400">
        최근 {TREND_WEEKS}주 기록이 없어요
      </div>
    );
  }
  const active = hover ?? latest;
  const current = points[active];

  return (
    <div className="rounded-2xl border border-grey-100 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[13px] font-semibold text-grey-700">성적 추이</p>
        <div className="flex items-center gap-3 text-[12px] text-grey-600">
          <LegendItem color={QUIZ_COLOR} label="퀴즈 정답률" />
          <LegendItem color={SUMMARY_COLOR} label="요약 점수" square />
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block w-full"
        role="img"
        aria-label={`최근 ${n}주 성적 추이. ${points
          .map((p, i) => `${label(i)} 퀴즈 ${percent(p.quiz)}, 요약 ${formatScore(p.summary)}`)
          .join(". ")}`}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke="#f2f4f6" strokeWidth={1} />
            <text x={left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="#8b95a1">
              {v}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text
            key={p.week}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize={11}
            fontWeight={i === active ? 600 : 400}
            fill={i === active ? "#333d4b" : "#8b95a1"}
          >
            {label(i)}
          </text>
        ))}
        <line x1={x(active)} x2={x(active)} y1={top} y2={H - bottom} stroke="#d1d6db" strokeWidth={1} strokeDasharray="3 3" />

        <path
          d={linePath(points.map((p) => p.summary), x, y)}
          fill="none"
          stroke={SUMMARY_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={linePath(points.map((p) => p.quiz), x, y)}
          fill="none"
          stroke={QUIZ_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map(
          (p, i) =>
            p.summary !== null && (
              <rect
                key={`s${p.week}`}
                x={x(i) - 4}
                y={y(p.summary) - 4}
                width={8}
                height={8}
                rx={1.5}
                fill={SUMMARY_COLOR}
                stroke="#fff"
                strokeWidth={2}
              />
            ),
        )}
        {points.map(
          (p, i) =>
            p.quiz !== null && (
              <circle key={`q${p.week}`} cx={x(i)} cy={y(p.quiz)} r={4.5} fill={QUIZ_COLOR} stroke="#fff" strokeWidth={2} />
            ),
        )}
        {/* 주마다 마우스를 올리거나 누를 수 있는 넓은 영역 */}
        {points.map((p, i) => (
          <rect
            key={`hit${p.week}`}
            x={n > 1 ? x(i) - step / 2 : 0}
            y={0}
            width={n > 1 ? step : W}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onClick={() => setHover(i)}
          />
        ))}
      </svg>

      <p className="mt-1 text-[12px] tabular-nums text-grey-600">
        <b className="font-semibold text-grey-800">{active === n - 1 ? "이번 주" : `${shortWeek(current.week)} 주`}</b> · 퀴즈{" "}
        {percent(current.quiz)} · 요약 {formatScore(current.summary)}
      </p>
    </div>
  );
}

function LegendItem({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2", square ? "rounded-[2px]" : "rounded-full")} style={{ background: color }} />
      {label}
    </span>
  );
}
