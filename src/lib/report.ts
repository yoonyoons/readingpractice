import type { Article, QuizType, StudentRecord, Submission, Worksheet } from "./types";
import { QUIZ_TYPE_LABEL, seoulDate, weekKey } from "./utils";

/*
 * 결과 분석표
 * 학생이 제출한 날짜(서울 시간)를 기준으로 기간 안의 퀴즈·요약 결과를 모은다.
 * 퀴즈는 첫 답만(학생 화면과 같은 기준), 요약은 기사마다 기간 안에 마지막으로 제출한 것만 센다.
 */

/** 서울 날짜 기준 기간 (양 끝 포함). null이면 전체 기간 */
export interface DateRange {
  from: string;
  to: string;
}

/** 이 비율(요약은 30점) 미만이면 도움이 필요한 학생으로 표시한다 */
export const HELP_RATE = 0.3;
/** 도움 필요 여부는 학생이 제출한 최근 3주(주마다 보통 기사 2개)로 판단한다 */
export const RECENT_WEEKS = 3;
/** 반 화면의 결과 분석표와 성적 추이는 이번 주를 포함한 최근 4주를 본다 */
export const TREND_WEEKS = 4;
/** 이 비율 미만인 퀴즈 유형·요약 항목을 취약 영역으로 보여 준다 */
export const WEAK_RATE = 0.4;

export interface Tally {
  answered: number;
  correct: number;
}

export interface WordCount {
  word: string;
  count: number;
}

export interface StudentReport {
  studentId: string;
  number: number;
  name: string;
  /** 기간 안에 퀴즈나 요약을 낸 기사 수 */
  articleCount: number;
  quiz: Tally & {
    /** 0~1. 푼 문항이 없으면 null */
    rate: number | null;
    byType: Record<QuizType, Tally>;
    /** 틀린 빈칸·비슷한 말 문제의 낱말 (많이 틀린 순) */
    missedWords: WordCount[];
  };
  summary: {
    count: number;
    /** 100점 만점 평균. 제출이 없으면 null */
    average: number | null;
    /** 영역별 평균 (핵심 내용 50, 내 말로 표현 30, 문장 완성도 20점 만점) */
    content: number | null;
    ownWords: number | null;
    sentence: number | null;
    /** 제출 순서대로 */
    history: { date: string; score: number; title: string }[];
  };
  /** 기록이 있는 주별 결과 (주 시작 월요일 YYYY-MM-DD, 오래된 주부터) */
  weekly: { week: string; quizRate: number | null; summaryAverage: number | null }[];
  recent: {
    /** 실제로 센 주 수 (최대 RECENT_WEEKS) */
    weeks: number;
    quizRate: number | null;
    summaryAverage: number | null;
    needsHelp: boolean;
  };
}

export interface ClassReportStats {
  students: StudentReport[];
  /** 기간 안에 기록이 있는 학생 수 */
  activeCount: number;
  quizRate: number | null;
  summaryAverage: number | null;
  needsHelpCount: number;
  missedWords: WordCount[];
}

const inRange = (iso: string, range: DateRange | null) => {
  if (!range) return true;
  const date = seoulDate(iso);
  return date >= range.from && date <= range.to;
};

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

const emptyTally = (): Tally => ({ answered: 0, correct: 0 });

function sortWords(counts: Map<string, number>, limit: number): WordCount[] {
  return [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

/** 틀렸을 때 다시 볼 낱말: 빈칸은 정답 낱말, 비슷한 말은 밑줄 친 낱말 */
function missedWord(article: Article, questionId: string) {
  const q = article.quiz.find((x) => x.id === questionId);
  if (!q) return "";
  if (q.type === "blank") return q.choices[q.answer] ?? "";
  if (q.type === "synonym") return q.target;
  return "";
}

export function buildStudentReport(
  student: Pick<StudentRecord, "id" | "number" | "name">,
  worksheets: Worksheet[],
  submissions: Submission[],
  range: DateRange | null,
): StudentReport {
  const articles = new Map<string, Article>();
  for (const w of worksheets) for (const a of w.articles) articles.set(`${w.id}:${a.id}`, a);

  const byType: Record<QuizType, Tally> = { blank: emptyTally(), synonym: emptyTally(), comprehension: emptyTally() };
  const missed = new Map<string, number>();
  const quizWeeks: (Tally & { week: string })[] = [];
  const summaries: { week: string; date: string; score: number; title: string; breakdown: [number, number, number] }[] = [];
  let articleCount = 0;

  for (const sub of submissions) {
    if (sub.studentId !== student.id) continue;
    const article = articles.get(`${sub.worksheetId}:${sub.articleId}`);
    if (!article) continue;
    let counted = false;

    const questions = article.quiz.filter((q) => sub.quizAnswers[q.id]);
    const quizAt = sub.quizDoneAt ?? sub.updatedAt;
    if (questions.length > 0 && inRange(quizAt, range)) {
      counted = true;
      const tally = emptyTally();
      for (const q of questions) {
        tally.answered++;
        byType[q.type].answered++;
        if (sub.quizAnswers[q.id].correct) {
          tally.correct++;
          byType[q.type].correct++;
        } else {
          const word = missedWord(article, q.id);
          if (word) missed.set(word, (missed.get(word) ?? 0) + 1);
        }
      }
      quizWeeks.push({ ...tally, week: weekKey(new Date(quizAt)) });
    }

    const attempt = sub.summaries.filter((s) => inRange(s.submittedAt, range)).at(-1);
    if (attempt) {
      counted = true;
      const { content, ownWords, sentence } = attempt.feedback.breakdown;
      summaries.push({
        week: weekKey(new Date(attempt.submittedAt)),
        date: attempt.submittedAt,
        score: attempt.feedback.score,
        title: article.title,
        breakdown: [content, ownWords, sentence],
      });
    }
    if (counted) articleCount++;
  }

  summaries.sort((a, b) => a.date.localeCompare(b.date));
  const answered = quizWeeks.reduce((n, t) => n + t.answered, 0);
  const correct = quizWeeks.reduce((n, t) => n + t.correct, 0);

  const allWeeks = [...new Set([...quizWeeks, ...summaries].map((x) => x.week))].sort();
  const weeks = allWeeks.slice(-RECENT_WEEKS);
  const recentQuiz = quizWeeks.filter((t) => weeks.includes(t.week));
  const recentAnswered = recentQuiz.reduce((n, t) => n + t.answered, 0);
  const quizRate = recentAnswered ? recentQuiz.reduce((n, t) => n + t.correct, 0) / recentAnswered : null;
  const summaryAverage = average(summaries.filter((s) => weeks.includes(s.week)).map((s) => s.score));

  return {
    studentId: student.id,
    number: student.number,
    name: student.name,
    articleCount,
    quiz: {
      answered,
      correct,
      rate: answered ? correct / answered : null,
      byType,
      missedWords: sortWords(missed, 8),
    },
    summary: {
      count: summaries.length,
      average: average(summaries.map((s) => s.score)),
      content: average(summaries.map((s) => s.breakdown[0])),
      ownWords: average(summaries.map((s) => s.breakdown[1])),
      sentence: average(summaries.map((s) => s.breakdown[2])),
      history: summaries.map(({ date, score, title }) => ({ date, score, title })),
    },
    weekly: allWeeks.map((week) => {
      const quiz = quizWeeks.filter((t) => t.week === week);
      const answeredInWeek = quiz.reduce((n, t) => n + t.answered, 0);
      return {
        week,
        quizRate: answeredInWeek ? quiz.reduce((n, t) => n + t.correct, 0) / answeredInWeek : null,
        summaryAverage: average(summaries.filter((s) => s.week === week).map((s) => s.score)),
      };
    }),
    recent: {
      weeks: weeks.length,
      quizRate,
      summaryAverage,
      needsHelp: (quizRate !== null && quizRate < HELP_RATE) || (summaryAverage !== null && summaryAverage < HELP_RATE * 100),
    },
  };
}

export function buildClassReport(
  students: Pick<StudentRecord, "id" | "number" | "name">[],
  worksheets: Worksheet[],
  submissions: Submission[],
  range: DateRange | null,
): ClassReportStats {
  const byStudent = new Map<string, Submission[]>();
  for (const sub of submissions) byStudent.set(sub.studentId, [...(byStudent.get(sub.studentId) ?? []), sub]);

  const reports = students.map((s) => buildStudentReport(s, worksheets, byStudent.get(s.id) ?? [], range));
  const answered = reports.reduce((n, r) => n + r.quiz.answered, 0);
  const correct = reports.reduce((n, r) => n + r.quiz.correct, 0);
  const missed = new Map<string, number>();
  for (const r of reports) for (const w of r.quiz.missedWords) missed.set(w.word, (missed.get(w.word) ?? 0) + w.count);

  return {
    students: reports,
    activeCount: reports.filter((r) => r.articleCount > 0).length,
    quizRate: answered ? correct / answered : null,
    summaryAverage: average(reports.flatMap((r) => r.summary.history.map((h) => h.score))),
    needsHelpCount: reports.filter((r) => r.recent.needsHelp).length,
    missedWords: sortWords(missed, 5),
  };
}

export interface WeakArea {
  label: string;
  detail: string;
}

/** 퀴즈 유형과 요약 항목 중 WEAK_RATE 미만인 것 */
export function weakAreas(student: StudentReport): WeakArea[] {
  const areas: WeakArea[] = [];
  for (const [type, label] of Object.entries(QUIZ_TYPE_LABEL) as [QuizType, string][]) {
    const { answered, correct } = student.quiz.byType[type];
    if (answered && correct / answered < WEAK_RATE) {
      areas.push({ label: `${label} 퀴즈`, detail: `${Math.round((correct / answered) * 100)}% (${correct}/${answered})` });
    }
  }
  const parts: [string, number | null, number][] = [
    ["핵심 내용", student.summary.content, 50],
    ["내 말로 표현", student.summary.ownWords, 30],
    ["문장 완성도", student.summary.sentence, 20],
  ];
  for (const [label, value, max] of parts) {
    if (value !== null && value / max < WEAK_RATE) {
      areas.push({ label: `요약 · ${label}`, detail: `${Math.round(value)}/${max}점` });
    }
  }
  return areas;
}

/** 0~1 비율을 "71%"로, 없으면 "-" */
export function formatRate(rate: number | null) {
  return rate === null ? "-" : `${Math.round(rate * 100)}%`;
}

/** 점수를 "68점"으로, 없으면 "-" */
export function formatScore(score: number | null) {
  return score === null ? "-" : `${Math.round(score)}점`;
}
