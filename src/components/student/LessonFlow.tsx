"use client";

import Link from "next/link";
import { Fragment, type SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  BottomBar,
  Button,
  CheckIcon,
  ChevronLeft,
  ErrorText,
  LinkButton,
  Modal,
  ProgressBar,
  ScoreRing,
  Spinner,
  Textarea,
} from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import { GRADES, MAX_OPINION_CHARS, MAX_SUMMARY_ATTEMPTS, MAX_SUMMARY_CHARS, usesKeywordSummary } from "@/lib/grades";
import type {
  GradeLevel,
  KeywordPiece,
  OpinionAnswer,
  OpinionBoard,
  PublicArticle,
  PublicBlank,
  PublicKeywordSummary,
  SourceItem,
  SummaryAttempt,
  VocabItem,
} from "@/lib/types";
import { countStars, MAX_STARS, STAR_QUIZ_RATE, STAR_SUMMARY_SCORE } from "@/lib/stars";
import { UnlockCelebration } from "./UnlockCelebration";
import { cn, QUIZ_TYPE_LABEL } from "@/lib/utils";

type Step = "read" | "quiz" | "quizDone" | "summary" | "result" | "opinion" | "board";
type PublicQuiz = PublicArticle["quiz"][number];
type Score = { correct: number; total: number };

interface Revealed {
  modelSummary: string;
  keyPoints: string[];
}

export interface LessonInitial {
  read: boolean;
  answeredIds: string[];
  quizCorrect: number;
  /** 관심 분야 학습에서 퀴즈를 다시 풀기 전까지 가장 많이 맞힌 개수 */
  quizBest?: number | null;
  /** 관심 분야 학습: 이 화면을 열 때 이미 모은 별 */
  stars?: number;
  summaries: SummaryAttempt[];
  revealed: Revealed | null;
  opinion: OpinionAnswer | null;
  board: OpinionBoard | null;
}

interface Props {
  worksheetId: string;
  article: PublicArticle;
  gradeLevel: GradeLevel;
  initial: LessonInitial;
  nextHref: string | null;
  /** 목록으로 돌아갈 주소 (관심 분야 학습은 /s/explore) */
  homeHref?: string;
  /** 관심 분야 학습: 요약 결과에 모은 별을 보여 주고, 퀴즈를 다시 풀 수 있다 */
  showStars?: boolean;
  /** 관심 분야 학습: 이 기사에서 별 3개를 모으면 열리는 같은 분야 다음 기사 */
  unlockNext?: { href: string; keyword: string; title: string } | null;
  /** 선생님이 학습을 종료한 학습지: 기사와 내 기록만 보고 더 제출할 수 없다 */
  ended?: boolean;
}

export function LessonFlow({
  worksheetId,
  article,
  gradeLevel,
  initial,
  nextHref,
  homeHref = "/s",
  showStars = false,
  unlockNext = null,
  ended = false,
}: Props) {
  const hasOpinion = Boolean(article.opinionQuestion) && article.stances.length >= 2;
  const [step, setStep] = useState<Step>(() => {
    if (!initial.read) return "read";
    if (!article.quiz.every((q) => initial.answeredIds.includes(q.id))) return "quiz";
    if (initial.summaries.length === 0) return "summary";
    if (!hasOpinion) return "result";
    return initial.opinion ? "board" : "opinion";
  });
  const [quizScore, setQuizScore] = useState<Score>({ correct: initial.quizCorrect, total: article.quiz.length });
  const [summaries, setSummaries] = useState(initial.summaries);
  const [revealed, setRevealed] = useState(initial.revealed);
  const [opinion, setOpinion] = useState(initial.opinion);
  const [board, setBoard] = useState(initial.board);
  const [answeredIds, setAnsweredIds] = useState(initial.answeredIds);
  const [quizBest, setQuizBest] = useState(initial.quizBest ?? null);
  const [quizRound, setQuizRound] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [retryError, setRetryError] = useState("");

  const go = (next: Step) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };
  const latest = summaries.at(-1) ?? null;
  const attemptsLeft = MAX_SUMMARY_ATTEMPTS - summaries.length;
  const bestQuiz = Math.max(quizScore.correct, quizBest ?? 0);
  const stars = showStars
    ? countStars({
        quizDone: true,
        quizCorrect: bestQuiz,
        quizTotal: quizScore.total,
        bestSummary: summaries.length ? Math.max(...summaries.map((s) => s.feedback.score)) : null,
      })
    : null;
  // 별 3개를 이번에 처음 모았으면 다음 기사가 열리는 장면을 한 번 보여 준다
  const onUnlockStar = (nextStars: number) => {
    if (nextStars === MAX_STARS && (initial.stars ?? 0) < MAX_STARS && unlockNext) setCelebrate(true);
  };

  async function retryQuiz() {
    setRetryError("");
    try {
      const data = await apiFetch<{ quizBest: number }>("/api/student/quiz/retry", {
        body: { worksheetId, articleId: article.id },
      });
      setQuizBest(data.quizBest);
      setAnsweredIds([]);
      setQuizRound((n) => n + 1);
      go("quiz");
    } catch (e) {
      setRetryError(errorMessage(e));
    }
  }

  if (ended) {
    return (
      <EndedView
        article={article}
        homeHref={homeHref}
        read={initial.read}
        quizScore={article.quiz.every((q) => initial.answeredIds.includes(q.id)) ? quizScore : null}
        latest={latest}
        opinion={opinion}
      />
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-white md:max-w-3xl lg:max-w-5xl">
      <LessonHeader step={step} hasOpinion={hasOpinion} homeHref={homeHref} />
      {celebrate && unlockNext && <UnlockCelebration next={unlockNext} onClose={() => setCelebrate(false)} />}

      {step === "read" && (
        <ReadStep
          worksheetId={worksheetId}
          article={article}
          onDone={() => go(article.quiz.length > 0 ? "quiz" : "summary")}
        />
      )}

      {step === "quiz" && (
        <QuizStep
          key={quizRound}
          worksheetId={worksheetId}
          article={article}
          answeredIds={answeredIds}
          onFinished={(score) => {
            setQuizScore(score);
            go("quizDone");
          }}
        />
      )}

      {step === "quizDone" && (
        <QuizDone
          score={quizScore}
          // 다시 푼 퀴즈면 요약은 이미 냈으므로 결과로 돌아간다
          nextLabel={summaries.length > 0 ? "결과 보러 가기" : "요약하러 가기"}
          onNext={() => {
            if (summaries.length === 0) return go("summary");
            onUnlockStar(
              countStars({
                quizDone: true,
                quizCorrect: Math.max(quizScore.correct, quizBest ?? 0),
                quizTotal: quizScore.total,
                bestSummary: Math.max(...summaries.map((s) => s.feedback.score)),
              }),
            );
            go("result");
          }}
        />
      )}

      {step === "summary" && (
        <SummaryStepFor
          keyword={usesKeywordSummary(gradeLevel)}
          worksheetId={worksheetId}
          article={article}
          gradeLevel={gradeLevel}
          attemptsLeft={attemptsLeft}
          initialText={latest?.text ?? ""}
          onSubmitted={(data) => {
            const all = [...summaries, data.attempt];
            setSummaries(all);
            setRevealed({ modelSummary: data.modelSummary, keyPoints: data.keyPoints });
            if (showStars) {
              onUnlockStar(
                countStars({
                  quizDone: true,
                  quizCorrect: bestQuiz,
                  quizTotal: quizScore.total,
                  bestSummary: Math.max(...all.map((s) => s.feedback.score)),
                }),
              );
            }
            go("result");
          }}
        />
      )}

      {step === "result" && latest && (
        <ResultStep
          attempt={latest}
          attemptsLeft={attemptsLeft}
          revealed={revealed}
          quizScore={quizScore}
          // 별 3개로 다음 기사가 열렸으면 그 기사로 이어서 간다
          nextHref={stars === MAX_STARS && unlockNext ? unlockNext.href : nextHref}
          homeHref={homeHref}
          stars={stars}
          quizRetry={
            showStars && bestQuiz < Math.ceil(STAR_QUIZ_RATE * quizScore.total)
              ? { onClick: retryQuiz, error: retryError }
              : null
          }
          onRetry={() => go("summary")}
          next={
            hasOpinion
              ? {
                label: opinion ? "친구들 생각 보기" : "생각 나누러 가기",
                onClick: () => go(opinion ? "board" : "opinion"),
              }
              : null
          }
        />
      )}

      {step === "opinion" && (
        <OpinionStep
          worksheetId={worksheetId}
          article={article}
          gradeLevel={gradeLevel}
          initial={opinion}
          onSubmitted={(data) => {
            setOpinion(data.opinion);
            setBoard(data.board);
            go("board");
          }}
        />
      )}

      {step === "board" && opinion && board && (
        <BoardStep
          article={article}
          board={board}
          opinion={opinion}
          nextHref={nextHref}
          onEdit={() => go("opinion")}
          onShowFeedback={() => go("result")}
        />
      )}
    </div>
  );
}

/* ───────────── 공통 레이아웃 (휴대폰: 한 단, 태블릿 가로: 넓은 본문·두 단) ───────────── */

/** 본문 좌우 여백. 컨테이너 너비(md:max-w-3xl, lg:max-w-5xl)에 맞춰 커진다 */
const PAD = "px-5 md:px-8 lg:px-12";
/** 하단 고정 버튼 영역을 본문과 같은 너비·여백으로 맞춘다 */
const BAR = "md:max-w-3xl md:px-8 lg:max-w-5xl lg:px-12";

/* ───────────── 상단 단계 표시 ───────────── */

const STEP_INDEX: Record<Step, number> = { read: 0, quiz: 1, quizDone: 1, summary: 2, result: 3, opinion: 3, board: 4 };

function LessonHeader({ step, hasOpinion, homeHref }: { step: Step; hasOpinion: boolean; homeHref: string }) {
  const labels = hasOpinion ? ["읽기", "퀴즈", "요약", "생각"] : ["읽기", "퀴즈", "요약"];
  const current = STEP_INDEX[step];
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center bg-white/95 px-2 backdrop-blur md:h-16 md:px-5 lg:px-9">
      <Link href={homeHref} className="rounded-full p-2 text-grey-800 hover:bg-grey-100" aria-label="목록으로">
        <ChevronLeft />
      </Link>
      <ol className="flex flex-1 items-center justify-center gap-1.5">
        {labels.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex items-center gap-1.5">
              {i > 0 && <span className="h-px w-2.5 bg-grey-300" />}
              <span
                className={cn(
                  "flex items-center gap-1 text-[13px] font-semibold md:text-[14px]",
                  active ? "text-grey-900" : done ? "text-primary" : "text-grey-400",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[11px]",
                    done ? "bg-primary text-white" : active ? "bg-grey-900 text-white" : "bg-grey-200 text-grey-500",
                  )}
                >
                  {done ? <CheckIcon className="size-3" /> : i + 1}
                </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <span className="w-10" />
    </header>
  );
}

/* ───────────── 1단계: 기사 읽기 ───────────── */

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, vocab, onWord }: { text: string; vocab: VocabItem[]; onWord: (v: VocabItem) => void }) {
  const words = vocab.map((v) => v.word).filter(Boolean).sort((a, b) => b.length - a.length);
  if (words.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.map(escapeRegExp).join("|")})`, "g"));
  return (
    <>
      {parts.map((part, i) => {
        const item = i % 2 === 1 ? vocab.find((v) => v.word === part) : undefined;
        if (!item) return <Fragment key={i}>{part}</Fragment>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onWord(item)}
            className="rounded bg-primary-weak px-0.5 font-semibold text-primary-hover decoration-primary/40 decoration-2 underline-offset-4 hover:underline"
          >
            {part}
          </button>
        );
      })}
    </>
  );
}

function Sources({ sources }: { sources: SourceItem[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-10 border-t border-grey-100 pt-5">
      <p className="text-[13px] font-semibold text-grey-500">참고한 기사</p>
      <ul className="mt-2 space-y-1.5">
        {sources.slice(0, 3).map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-1 text-[13px] text-grey-500 underline-offset-2 hover:underline"
            >
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArticleBody({
  article,
  onWord,
  numbered = false,
}: {
  article: PublicArticle;
  onWord: (v: VocabItem) => void;
  /** 초3~4 키워드 요약: 문단 앞에 '1문단'처럼 번호를 붙이고 핵심 어휘는 칠하지 않는다 */
  numbered?: boolean;
}) {
  return (
    <div className="space-y-5 text-[17px] leading-[1.85] text-grey-800 md:text-[18px]">
      {article.paragraphs.map((p, i) => (
        <p key={i}>
          {numbered && <ParagraphTag index={i} className="mr-1.5 align-[2px]" />}
          {/* 키워드 찾기에서는 핵심 어휘를 칠하면 답이 보이므로 그냥 글로 보여 준다 */}
          {numbered ? p : <HighlightedText text={p} vocab={article.vocab} onWord={onWord} />}
        </p>
      ))}
    </div>
  );
}

function WhyCard({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-2xl bg-grey-50 p-4">
      <p className="text-[13px] font-bold text-primary">왜 알아야 할까요?</p>
      <p className="mt-1 text-[15px] leading-relaxed text-grey-700">{text}</p>
    </div>
  );
}

/** 태블릿 가로 화면의 오른쪽에 붙는 핵심 어휘 목록. 누르면 뜻 창이 열린다 */
function VocabAside({ vocab, onWord }: { vocab: VocabItem[]; onWord: (v: VocabItem) => void }) {
  if (vocab.length === 0) return null;
  return (
    <div className="rounded-2xl border border-grey-100 p-4">
      <p className="text-[13px] font-bold text-grey-800">핵심 어휘</p>
      <ul className="mt-3 space-y-3">
        {vocab.map((v) => (
          <li key={v.word}>
            <button type="button" onClick={() => onWord(v)} className="w-full text-left">
              <span className="rounded bg-primary-weak px-1 text-[15px] font-semibold text-primary-hover">{v.word}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-grey-600">{v.meaning}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 태블릿 가로 화면에서 요약·생각 쓰기 옆에 항상 보이는 기사 패널 */
function ArticlePanel({
  article,
  onWord,
  numbered = false,
}: {
  article: PublicArticle;
  onWord: (v: VocabItem) => void;
  numbered?: boolean;
}) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-[88px] max-h-[calc(100dvh-210px)] overflow-y-auto rounded-2xl border border-grey-100 p-5">
        <p className="text-[12px] font-semibold text-grey-500">📰 기사 다시 보기</p>
        <p className="mt-1 mb-3 text-[17px] font-bold text-grey-900">{article.title}</p>
        <div className="[&_div]:space-y-3 [&_div]:text-[15px] [&_div]:leading-relaxed">
          <ArticleBody article={article} onWord={onWord} numbered={numbered} />
        </div>
      </div>
    </aside>
  );
}

function ReadStep({ worksheetId, article, onDone }: { worksheetId: string; article: PublicArticle; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeWord, setActiveWord] = useState<VocabItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // 글자 수에 비례한 최소 읽기 시간 (10~60초): 스크롤만 휙 내리는 것을 막는다
  const minSeconds = useMemo(() => {
    const chars = article.paragraphs.join("").length;
    return Math.min(60, Math.max(10, Math.round(chars / 40)));
  }, [article.paragraphs]);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? el.scrollTop / max : 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setReachedEnd(true);
    });
    if (endRef.current) observer.observe(endRef.current);

    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      clearInterval(timer);
    };
  }, []);

  const remaining = Math.max(0, minSeconds - elapsed);
  const canFinish = reachedEnd && remaining === 0;
  const label = !reachedEnd
    ? `끝까지 읽어 주세요 · ${Math.round(progress * 100)}%`
    : remaining > 0
      ? `꼼꼼히 읽는 중이에요 · ${remaining}초`
      : "다 읽었어요, 퀴즈 풀기";

  async function finish() {
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/student/read", { body: { worksheetId, articleId: article.id } });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <>
      <div className={cn("sticky top-14 z-20 bg-white pb-2 md:top-16", PAD)}>
        <ProgressBar value={reachedEnd ? 1 : progress} className="h-1" />
      </div>

      <article className={cn("animate-fade-up pb-40 pt-4 md:pt-6", PAD)}>
        {/* 태블릿 가로: 왼쪽 본문, 오른쪽에 '왜 알아야 할까요?'와 핵심 어휘 목록 */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
          <div className="min-w-0">
            <Badge tone="blue">{article.topic}</Badge>
            <h1 className="mt-3 text-[26px] font-bold leading-snug tracking-tight text-grey-900 md:text-[32px]">
              {article.title}
            </h1>
            <p className="mt-2 text-[13px] text-grey-400">🤖 AI가 뉴스를 조사해 쓰고 선생님이 확인한 기사예요</p>

            <div className="mt-5 lg:hidden">
              <WhyCard text={article.whyItMatters} />
            </div>

            {article.vocab.length > 0 && (
              <p className="mt-6 text-[13px] text-grey-500">
                <span className="rounded bg-primary-weak px-1 font-semibold text-primary-hover">파란 낱말</span>을 누르면
                뜻을 볼 수 있어요
              </p>
            )}

            <div className="mt-4">
              <ArticleBody article={article} onWord={setActiveWord} />
            </div>
            <div ref={endRef} className="h-px" />
            <Sources sources={article.sources} />
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-4">
              <WhyCard text={article.whyItMatters} />
              <VocabAside vocab={article.vocab} onWord={setActiveWord} />
            </div>
          </aside>
        </div>
      </article>

      <Modal open={Boolean(activeWord)} onClose={() => setActiveWord(null)} title={activeWord?.word}>
        <p className="text-[17px] leading-relaxed text-grey-700">{activeWord?.meaning}</p>
        <Button size="lg" variant="grey" className="mt-6 w-full" onClick={() => setActiveWord(null)}>
          확인
        </Button>
      </Modal>

      <BottomBar className={BAR}>
        <div className="mb-2 text-center">
          <ErrorText>{error}</ErrorText>
        </div>
        <Button size="lg" className="w-full md:mx-auto md:block md:max-w-md" disabled={!canFinish} loading={saving} onClick={finish}>
          {label}
        </Button>
      </BottomBar>
    </>
  );
}

/* ───────────── 2단계: 어휘 퀴즈 ───────────── */

interface AnswerResult {
  choice: number;
  correct: boolean;
  answer: number;
  explanation: string;
  done: boolean;
  score: number;
  total: number;
}

function SentenceView({ q }: { q: PublicQuiz }) {
  if (q.type === "blank") {
    const parts = q.sentence.split(/(\(\s*\))/);
    return (
      <>
        {parts.map((p, i) =>
          i % 2 === 1 ? (
            <span key={i} className="mx-1 inline-block h-5 w-16 border-b-2 border-primary align-middle" />
          ) : (
            <Fragment key={i}>{p}</Fragment>
          ),
        )}
      </>
    );
  }
  const index = q.target ? q.sentence.indexOf(q.target) : -1;
  if (index < 0) return <>{q.sentence}</>;
  return (
    <>
      {q.sentence.slice(0, index)}
      <span className="font-bold text-grey-900 underline decoration-primary decoration-2 underline-offset-4">{q.target}</span>
      {q.sentence.slice(index + q.target.length)}
    </>
  );
}

function QuizStep({
  worksheetId,
  article,
  answeredIds,
  onFinished,
}: {
  worksheetId: string;
  article: PublicArticle;
  answeredIds: string[];
  onFinished: (score: Score) => void;
}) {
  const quiz = article.quiz;
  const [index, setIndex] = useState(() => Math.max(0, quiz.findIndex((q) => !answeredIds.includes(q.id))));
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState("");
  const q = quiz[index];
  const isLast = index === quiz.length - 1;

  async function choose(choice: number) {
    if (result || pending !== null) return;
    setPending(choice);
    setError("");
    try {
      setResult(
        await apiFetch<AnswerResult>("/api/student/quiz", {
          body: { worksheetId, articleId: article.id, questionId: q.id, choice },
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  function next() {
    if (!result) return;
    if (isLast) {
      onFinished({ correct: result.score, total: result.total });
      return;
    }
    setIndex(index + 1);
    setResult(null);
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      <div key={q.id} className={cn("mx-auto w-full max-w-3xl animate-fade-up pb-40 pt-4 md:pt-8", PAD)}>
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold text-grey-500">
            <span className="text-primary">{index + 1}</span> / {quiz.length}
          </span>
          <Badge tone="grey">{QUIZ_TYPE_LABEL[q.type]}</Badge>
        </div>
        <ProgressBar value={(index + (result ? 1 : 0)) / quiz.length} className="mt-3" />

        <h2 className="mt-7 text-[21px] font-bold leading-snug text-grey-900 md:text-[24px]">{q.prompt}</h2>
        {q.sentence && (
          <div className="mt-4 rounded-2xl bg-grey-50 p-4 text-[16px] leading-[1.8] text-grey-700 md:p-5 md:text-[17px]">
            <SentenceView q={q} />
          </div>
        )}

        {/* 태블릿에서는 보기를 두 열로 */}
        <div className="mt-6 grid gap-2.5 md:grid-cols-2 md:gap-3">
          {q.choices.map((choice, i) => {
            const isAnswer = result && i === result.answer;
            const isWrongPick = result && i === result.choice && !result.correct;
            return (
              <button
                key={i}
                type="button"
                onClick={() => choose(i)}
                disabled={Boolean(result) || pending !== null}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left text-[16px] font-medium transition",
                  isAnswer
                    ? "animate-pop border-success bg-success-weak text-grey-900"
                    : isWrongPick
                      ? "border-danger bg-danger-weak text-grey-900"
                      : pending === i
                        ? "border-primary bg-primary-weak"
                        : result
                          ? "border-transparent bg-grey-50 text-grey-400"
                          : "border-transparent bg-grey-50 text-grey-800 hover:bg-grey-100 active:scale-[0.99]",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                    isAnswer ? "bg-success text-white" : isWrongPick ? "bg-danger text-white" : "bg-white text-grey-500",
                  )}
                >
                  {isAnswer ? <CheckIcon className="size-3.5" /> : isWrongPick ? "✕" : i + 1}
                </span>
                <span className="flex-1">{choice}</span>
                {pending === i && <Spinner className="size-4 text-primary" />}
              </button>
            );
          })}
        </div>

        {result && (
          <div className={cn("animate-fade-up mt-6 rounded-2xl p-4", result.correct ? "bg-primary-weak" : "bg-grey-50")}>
            <p className={cn("text-[16px] font-bold", result.correct ? "text-primary" : "text-grey-800")}>
              {result.correct ? "정답이에요! 🎉" : "아쉬워요, 정답을 확인해 볼까요?"}
            </p>
            {result.explanation && (
              <p className="mt-1.5 text-[15px] leading-relaxed text-grey-700">{result.explanation}</p>
            )}
          </div>
        )}
        <div className="mt-4">
          <ErrorText>{error}</ErrorText>
        </div>
      </div>

      {result && (
        <BottomBar className={BAR}>
          <Button size="lg" className="w-full md:mx-auto md:block md:max-w-md" onClick={next}>
            {isLast ? "결과 보기" : "다음 문제"}
          </Button>
        </BottomBar>
      )}
    </>
  );
}

function QuizDone({ score, nextLabel, onNext }: { score: Score; nextLabel: string; onNext: () => void }) {
  const ratio = score.total ? score.correct / score.total : 0;
  const emoji = ratio >= 0.85 ? "🏆" : ratio >= 0.6 ? "👏" : "💪";
  const message =
    ratio >= 0.85
      ? "어휘 실력이 대단해요!"
      : ratio >= 0.6
        ? "잘했어요! 틀린 낱말은 한 번 더 떠올려 봐요."
        : "괜찮아요. 낱말은 자주 만날수록 익숙해져요.";

  return (
    <>
      <div className="flex min-h-[calc(100dvh-56px)] flex-col items-center justify-center px-6 pb-32 text-center md:min-h-[calc(100dvh-64px)]">
        <div className="animate-pop text-7xl md:text-8xl">{emoji}</div>
        <p className="mt-8 text-[15px] font-semibold text-grey-500">어휘 퀴즈 결과</p>
        <h2 className="animate-fade-up mt-2 text-[28px] font-bold leading-snug text-grey-900 md:text-[34px]">
          {score.total}문제 중 <span className="text-primary">{score.correct}문제</span>
          <br />
          맞혔어요
        </h2>
        <p className="mt-3 text-[16px] text-grey-600 md:text-[17px]">{message}</p>
      </div>
      <BottomBar className={BAR}>
        <Button size="lg" className="w-full md:mx-auto md:block md:max-w-md" onClick={onNext}>
          {nextLabel}
        </Button>
      </BottomBar>
    </>
  );
}

/* ───────────── 3단계: 스스로 요약 ───────────── */

/** 초3~4는 키워드 낱말 요약, 그 밖의 학년은 스스로 요약 */
function SummaryStepFor({ keyword, ...props }: Parameters<typeof SummaryStep>[0] & { keyword: boolean }) {
  return keyword ? <KeywordSummaryStep {...props} /> : <SummaryStep {...props} />;
}

/** 기사 글자를 길게 눌러 선택·복사하지 못하게 한다 (iOS 길게 누르기 메뉴 포함) */
const NO_SELECT = "select-none [-webkit-touch-callout:none]";
/** 한 번에 이만큼보다 많은 글자가 늘어나면 붙여넣기로 본다 */
const PASTE_LIKE_CHARS = 30;

interface SummaryResponse {
  attempt: SummaryAttempt;
  attemptsLeft: number;
  modelSummary: string;
  keyPoints: string[];
}

function SummaryStep({
  worksheetId,
  article,
  gradeLevel,
  attemptsLeft,
  initialText,
  onSubmitted,
}: {
  worksheetId: string;
  article: PublicArticle;
  gradeLevel: GradeLevel;
  attemptsLeft: number;
  initialText: string;
  onSubmitted: (data: SummaryResponse) => void;
}) {
  const minChars = GRADES[gradeLevel].summaryMinChars;
  const [text, setText] = useState(initialText);
  const [showArticle, setShowArticle] = useState(false);
  const [activeWord, setActiveWord] = useState<VocabItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pasteNotice, setPasteNotice] = useState(false);
  const length = text.trim().length;

  // 요약은 스스로 써야 하므로 기사 복사와 요약 칸 붙여넣기·끌어 놓기를 막는다
  function blockCopy(e: SyntheticEvent) {
    if (e.target instanceof HTMLTextAreaElement) return;
    e.preventDefault();
  }
  function blockPaste(e: SyntheticEvent) {
    e.preventDefault();
    setPasteNotice(true);
  }
  function changeText(next: string) {
    // 키보드 앱의 클립보드 추천처럼 paste 이벤트 없이 긴 글이 한꺼번에 들어오는 경우도 막는다
    if (next.length - text.length > PASTE_LIKE_CHARS) {
      setPasteNotice(true);
      return;
    }
    setText(next.slice(0, MAX_SUMMARY_CHARS));
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      onSubmitted(
        await apiFetch<SummaryResponse>("/api/student/summary", {
          body: { worksheetId, articleId: article.id, text },
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className={cn("animate-fade-up pb-40 pt-4 md:pt-8", PAD)}
        onCopy={blockCopy}
        onCut={blockCopy}
        onDragStart={blockCopy}
        onContextMenu={blockCopy}
      >
        {/* 태블릿 가로: 왼쪽에 기사, 오른쪽에 요약 쓰기 */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-10">
          <div className={NO_SELECT}>
            <ArticlePanel article={article} onWord={setActiveWord} />
          </div>

          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-primary">스스로 요약하기</p>
            <h2 className="mt-1.5 text-[23px] font-bold leading-snug text-grey-900 md:text-[26px]">
              기사에서 중요한 내용을
              <br />내 말로 정리해 볼까요?
            </h2>

            <div className="mt-5 flex flex-wrap gap-2">
              {["무슨 일이 있었나요?", "왜 그런 일이 생겼나요?", "어떤 영향이 있나요?"].map((hint) => (
                <span key={hint} className="rounded-full bg-grey-100 px-3 py-1.5 text-[13px] font-medium text-grey-600">
                  {hint}
                </span>
              ))}
            </div>

            <div className={cn("lg:hidden", NO_SELECT)}>
              <ArticleToggle article={article} open={showArticle} onToggle={() => setShowArticle((v) => !v)} onWord={setActiveWord} />
            </div>

            <Textarea
              value={text}
              onChange={(e) => changeText(e.target.value)}
              onPaste={blockPaste}
              onDrop={blockPaste}
              autoComplete="off"
              rows={9}
              placeholder="기사를 읽고 중요하다고 생각한 내용을 써 보세요."
              className="mt-4 resize-none lg:min-h-[360px]"
            />
            {pasteNotice && (
              <p className="mt-2 text-[13px] font-medium text-grey-600">
                ✋ 요약은 붙여넣기 없이 내 말로 직접 써야 해요.
              </p>
            )}
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className={cn("font-medium", length >= minChars ? "text-primary" : "text-grey-500")}>
                {length}자 {length < minChars && `· ${minChars}자 이상 써 주세요`}
              </span>
              <span className="text-grey-500">남은 제출 기회 {attemptsLeft}번</span>
            </div>
            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
            </div>
          </div>
        </div>
      </div>

      <Modal open={Boolean(activeWord)} onClose={() => setActiveWord(null)} title={activeWord?.word}>
        <p className="text-[17px] leading-relaxed text-grey-700">{activeWord?.meaning}</p>
      </Modal>

      <BottomBar className={BAR}>
        <Button
          size="lg"
          className="w-full md:ml-auto md:block md:max-w-md"
          disabled={length < minChars || attemptsLeft <= 0}
          onClick={submit}
        >
          제출하고 피드백 받기
        </Button>
      </BottomBar>

      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95">
          <Spinner className="size-10 text-primary" />
          <p className="mt-6 text-[19px] font-bold text-grey-900">AI 선생님이 요약을 읽고 있어요</p>
          <p className="mt-1.5 text-[15px] text-grey-500">잠시만 기다려 주세요</p>
        </div>
      )}
    </>
  );
}

/* ───────────── 3단계 (초3~4): 키워드 낱말로 요약 ───────────── */

type BlankStatus = "idle" | "wrong" | "correct" | "revealed";
interface BlankState {
  value: string;
  /** 확인을 누른 횟수 */
  tries: number;
  status: BlankStatus;
  hint?: string;
  checking?: boolean;
}
interface CheckResponse {
  correct: boolean;
  hint?: string;
  answer?: string;
}

const EMPTY_BLANK: BlankState = { value: "", tries: 0, status: "idle" };
const isPublicBlank = (piece: KeywordPiece): piece is PublicBlank => typeof piece !== "string";
const solved = (b: BlankState | undefined) => b?.status === "correct" || b?.status === "revealed";

function ParagraphTag({ index, done = false, className }: { index: number; done?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[12px] font-bold leading-normal",
        done ? "bg-success-weak text-success" : "bg-warning-weak text-warning",
        className,
      )}
    >
      {index + 1} 문단{done && <CheckIcon className="size-3" />}
    </span>
  );
}

/** 글자 수만큼 네모 칸이 보이는 빈칸. 한글 입력(조합)이 끊기지 않도록 칸 위에 보이지 않는 입력창 하나를 겹친다 */
function BlankBoxes({
  blank,
  state,
  onChange,
  onCheck,
}: {
  blank: PublicBlank;
  state: BlankState;
  onChange: (value: string) => void;
  onCheck: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const done = solved(state);
  const total = blank.lengths.reduce((n, l) => n + l, 0);
  const chars = [...state.value.replace(/\s+/g, "")];
  let cursor = 0;
  const tone =
    state.status === "correct"
      ? "border-success bg-success-weak text-success"
      : state.status === "revealed"
        ? "border-grey-300 bg-grey-100 text-grey-600"
        : state.status === "wrong" && !focused
          ? "border-danger bg-danger-weak text-danger"
          : focused
            ? "border-primary bg-white text-grey-900"
            : "border-grey-300 bg-white text-grey-900";
  return (
    <span className="mx-1 inline-flex items-center gap-1.5 align-middle">
      <span className="relative inline-flex gap-2">
        {blank.lengths.map((length, w) => (
          <span key={w} className="inline-flex gap-[3px]">
            {Array.from({ length }, () => {
              const ch = chars[cursor++] ?? "";
              const hinted = !ch && cursor === 1 && state.hint && !done;
              return (
                <span
                  key={cursor}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-lg border-2 text-[17px] font-bold leading-none md:size-9",
                    tone,
                  )}
                >
                  {ch || (hinted ? <span className="text-grey-300">{state.hint}</span> : "")}
                </span>
              );
            })}
          </span>
        ))}
        {!done && (
          <input
            value={state.value}
            onChange={(e) => onChange(e.target.value.slice(0, total + blank.lengths.length + 2))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onCheck();
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label={`${total}글자 낱말`}
            className="absolute inset-0 w-full cursor-text bg-transparent text-[16px] text-transparent caret-transparent outline-none"
          />
        )}
      </span>
      {!done && state.value.trim() && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCheck}
          disabled={state.checking}
          className="rounded-lg bg-primary px-2.5 py-1 text-[13px] font-bold text-white disabled:opacity-50"
        >
          확인
        </button>
      )}
    </span>
  );
}

/** 문장 조각과 빈칸을 이어 보여 준다. 빈칸을 다 푼 뒤에는 낱말을 굵게 보여 줄 수도 있다 */
function KeywordSentence({
  pieces,
  blanks,
  onChange,
  onCheck,
  filled = false,
}: {
  pieces: KeywordPiece[];
  blanks: Record<string, BlankState>;
  onChange?: (id: string, value: string) => void;
  onCheck?: (id: string) => void;
  /** 빈칸 대신 학생이 찾은 낱말을 굵게 보여 준다 */
  filled?: boolean;
}) {
  return (
    <>
      {pieces.map((piece, i) =>
        !isPublicBlank(piece) ? (
          <Fragment key={i}>{piece}</Fragment>
        ) : filled ? (
          <b key={piece.id} className="font-bold text-grey-900">
            {blanks[piece.id]?.value}
          </b>
        ) : (
          <BlankBoxes
            key={piece.id}
            blank={piece}
            state={blanks[piece.id] ?? EMPTY_BLANK}
            onChange={(value) => onChange?.(piece.id, value)}
            onCheck={() => onCheck?.(piece.id)}
          />
        ),
      )}
    </>
  );
}

function BlankMessage({ state, wrongText }: { state: BlankState | undefined; wrongText: string }) {
  if (!state) return null;
  if (state.status === "revealed") {
    return (
      <p className="mt-1.5 text-[13px] font-semibold text-grey-600">
        정답은 ‘{state.value}’예요. 기사에서 이 낱말을 찾아 확인해 보세요.
      </p>
    );
  }
  if (state.status !== "wrong") return null;
  return (
    <>
      <p className="mt-1.5 text-[13px] font-semibold text-danger">{wrongText}</p>
      {state.hint && <p className="mt-0.5 text-[13px] font-semibold text-warning">💡 힌트: 첫 글자는 ‘{state.hint}’예요</p>}
    </>
  );
}

function KeywordSummaryStep({
  worksheetId,
  article,
  attemptsLeft,
  onSubmitted,
}: {
  worksheetId: string;
  article: PublicArticle;
  attemptsLeft: number;
  onSubmitted: (data: SummaryResponse) => void;
}) {
  const [data, setData] = useState<PublicKeywordSummary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [phase, setPhase] = useState<"paragraphs" | "summary">("paragraphs");
  const [blanks, setBlanks] = useState<Record<string, BlankState>>({});
  const [showArticle, setShowArticle] = useState(false);
  const [activeWord, setActiveWord] = useState<VocabItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [loadRound, setLoadRound] = useState(0);
  useEffect(() => {
    let alive = true;
    apiFetch<{ keywordSummary: PublicKeywordSummary }>("/api/student/keywords", {
      body: { worksheetId, articleId: article.id },
    })
      .then((res) => alive && setData(res.keywordSummary))
      .catch((e) => alive && setLoadError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [worksheetId, article.id, loadRound]);
  const load = () => {
    setLoadError("");
    setLoadRound((n) => n + 1);
  };

  const update = (id: string, patch: Partial<BlankState>) =>
    setBlanks((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_BLANK), ...patch } }));

  function change(id: string, value: string) {
    const prev = blanks[id] ?? EMPTY_BLANK;
    update(id, { value, status: prev.status === "wrong" ? "idle" : prev.status });
  }

  async function check(id: string) {
    const state = blanks[id] ?? EMPTY_BLANK;
    if (!state.value.trim() || state.checking || solved(state)) return;
    const tries = state.tries + 1;
    update(id, { checking: true });
    setError("");
    try {
      const res = await apiFetch<CheckResponse>("/api/student/keywords", {
        body: { worksheetId, articleId: article.id, check: { id, value: state.value, tries } },
      });
      if (res.correct) update(id, { tries, status: "correct", checking: false, value: state.value.trim() });
      else if (res.answer) update(id, { tries, status: "revealed", checking: false, value: res.answer });
      else update(id, { tries, status: "wrong", checking: false, hint: res.hint });
    } catch (e) {
      update(id, { checking: false });
      setError(errorMessage(e));
    }
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const body = Object.fromEntries(Object.entries(blanks).map(([id, b]) => [id, { value: b.value, tries: Math.max(1, b.tries) }]));
      onSubmitted(
        await apiFetch<SummaryResponse>("/api/student/summary", {
          body: { worksheetId, articleId: article.id, blanks: body },
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  }

  const paragraphBlanks = (data?.paragraphs ?? []).map((pieces) => pieces.filter(isPublicBlank));
  const doneParagraphs = paragraphBlanks.map((list) => list.every((b) => solved(blanks[b.id])));
  const allParagraphsDone = data !== null && doneParagraphs.every(Boolean);
  const summaryBlanks = (data?.summary ?? []).filter(isPublicBlank);
  const leftInSummary = summaryBlanks.filter((b) => !solved(blanks[b.id])).length;
  const current = doneParagraphs.findIndex((d) => !d);
  const found = [...new Set(paragraphBlanks.flat().map((b) => blanks[b.id]?.value).filter(Boolean))];

  return (
    <>
      <div
        className={cn("animate-fade-up pb-40 pt-4 md:pt-8", PAD)}
        onCopy={(e) => e.preventDefault()}
        onContextMenu={(e) => {
          if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
        }}
      >
        <div className="lg:grid lg:grid-cols-2 lg:gap-10">
          <div className={NO_SELECT}>
            <ArticlePanel article={article} onWord={setActiveWord} numbered />
          </div>

          <div className="min-w-0">
            {phase === "paragraphs" ? (
              <>
                <p className="text-[14px] font-semibold text-primary">요약 1단계 · 문단별 중심 내용</p>
                <h2 className="mt-1.5 text-[23px] font-bold leading-snug text-grey-900 md:text-[26px]">
                  문단마다 가장 중요한
                  <br />
                  낱말을 찾아 써 볼까요?
                </h2>
                {data && (
                  <div className="mt-4 flex gap-1.5">
                    {doneParagraphs.map((d, i) => (
                      <span key={i} className={cn("h-1.5 flex-1 rounded-full", d ? "bg-primary" : "bg-grey-200")} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-[14px] font-semibold text-primary">요약 2단계 · 이 글의 중심 내용</p>
                <h2 className="mt-1.5 text-[23px] font-bold leading-snug text-grey-900 md:text-[26px]">
                  찾은 낱말로
                  <br />글 전체를 요약해 봐요
                </h2>
              </>
            )}

            <div className={cn("lg:hidden", NO_SELECT)}>
              <ArticleToggle
                article={article}
                open={showArticle}
                onToggle={() => setShowArticle((v) => !v)}
                onWord={setActiveWord}
                numbered
              />
            </div>

            {!data && !loadError && (
              <div className="mt-10 flex flex-col items-center text-center">
                <Spinner className="size-8 text-primary" />
                <p className="mt-4 text-[15px] font-semibold text-grey-700">문단별 낱말 찾기를 준비하고 있어요</p>
              </div>
            )}
            {loadError && (
              <div className="mt-8 text-center">
                <ErrorText>{loadError}</ErrorText>
                <Button variant="grey" size="sm" className="mt-3" onClick={load}>
                  다시 불러오기
                </Button>
              </div>
            )}

            {data && phase === "paragraphs" && (
              <div className="mt-4 space-y-2.5">
                {data.paragraphs.map((pieces, i) => {
                  const list = paragraphBlanks[i];
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-2xl border p-3.5 transition",
                        i === current ? "border-primary ring-3 ring-primary-weak" : "border-grey-100",
                      )}
                    >
                      <ParagraphTag index={i} done={doneParagraphs[i]} />
                      <p className="mt-2 text-[16px] leading-[2.3] text-grey-800 md:text-[17px]">
                        <KeywordSentence pieces={pieces} blanks={blanks} onChange={change} onCheck={check} />
                      </p>
                      {list.map((b) => (
                        <BlankMessage
                          key={b.id}
                          state={blanks[b.id]}
                          wrongText={`앗, 다시 생각해 봐요. ${i + 1}문단을 한 번 더 읽어 볼까요?`}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {data && phase === "summary" && (
              <>
                {found.length > 0 && (
                  <>
                    <p className="mt-5 text-[14px] font-bold text-grey-800">내가 찾은 키워드</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {found.map((word) => (
                        <span key={word} className="rounded-full bg-primary-weak px-3 py-1.5 text-[14px] font-bold text-primary-hover">
                          {word}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <ul className="mt-3 divide-y divide-grey-100 rounded-2xl bg-grey-50 px-4 py-1.5">
                  {data.paragraphs.map((pieces, i) => (
                    <li key={i} className="flex gap-3 py-2 text-[14px] leading-relaxed text-grey-700">
                      <span className="shrink-0 text-grey-400">{i + 1}문단</span>
                      <span>
                        <KeywordSentence pieces={pieces} blanks={blanks} filled />
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-6 text-[14px] font-bold text-grey-800">빈칸을 채워 요약을 완성해요</p>
                <div className="mt-2 rounded-2xl border-2 border-primary-weak p-4">
                  <p className="text-[16px] leading-[2.4] text-grey-800 md:text-[17px]">
                    <KeywordSentence pieces={data.summary} blanks={blanks} onChange={change} onCheck={check} />
                  </p>
                  {summaryBlanks.map((b) => (
                    <BlankMessage key={b.id} state={blanks[b.id]} wrongText="앗, 다시 생각해 봐요. 위 키워드와 기사를 다시 살펴볼까요?" />
                  ))}
                </div>
                <p className="mt-2 text-right text-[13px] text-grey-500">남은 제출 기회 {attemptsLeft}번</p>
              </>
            )}

            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
            </div>
          </div>
        </div>
      </div>

      <Modal open={Boolean(activeWord)} onClose={() => setActiveWord(null)} title={activeWord?.word}>
        <p className="text-[17px] leading-relaxed text-grey-700">{activeWord?.meaning}</p>
      </Modal>

      <BottomBar className={BAR}>
        {phase === "paragraphs" ? (
          <Button
            size="lg"
            className="w-full md:ml-auto md:block md:max-w-md"
            disabled={!allParagraphsDone}
            onClick={() => {
              setPhase("summary");
              window.scrollTo({ top: 0 });
            }}
          >
            {allParagraphsDone ? "전체 요약하러 가기" : `${data?.paragraphs.length ?? ""}문단 모두 찾으면 다음으로`}
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full md:ml-auto md:block md:max-w-md"
            disabled={leftInSummary > 0 || attemptsLeft <= 0}
            loading={submitting}
            onClick={submit}
          >
            {leftInSummary > 0 ? `빈칸 ${leftInSummary}개 남았어요` : "제출하고 결과 보기"}
          </Button>
        )}
      </BottomBar>
    </>
  );
}

function ArticleToggle({
  article,
  open,
  onToggle,
  onWord,
  numbered = false,
}: {
  article: PublicArticle;
  open: boolean;
  onToggle: () => void;
  onWord: (v: VocabItem) => void;
  numbered?: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="mt-5 flex w-full items-center justify-between rounded-2xl bg-grey-50 px-4 py-3.5 text-[15px] font-semibold text-grey-700"
      >
        📰 기사 다시 보기
        <span className={cn("text-grey-400 transition", open && "rotate-180")}>▾</span>
      </button>
      {open && (
        <div className="mt-2 max-h-80 overflow-y-auto rounded-2xl border border-grey-100 p-4">
          <p className="mb-3 text-[16px] font-bold">{article.title}</p>
          <div className="[&_div]:space-y-3 [&_div]:text-[15px] [&_div]:leading-relaxed">
            <ArticleBody article={article} onWord={onWord} numbered={numbered} />
          </div>
        </div>
      )}
    </>
  );
}

/* ───────────── 요약 피드백 ───────────── */

function scoreMessage(score: number) {
  if (score >= 90) return "정말 훌륭한 요약이에요!";
  if (score >= 70) return "핵심을 잘 정리했어요!";
  if (score >= 50) return "조금만 더 다듬어 볼까요?";
  return "다시 한번 도전해 봐요!";
}

function StarCard({ stars, quizRetry }: { stars: number; quizRetry: { onClick: () => void; error: string } | null }) {
  return (
    <div className="mt-6 rounded-2xl bg-[#fff8e1] p-4 text-center">
      <p className="text-[30px] leading-none tracking-[0.15em]" aria-label={`별 ${stars}개`}>
        {Array.from({ length: MAX_STARS }, (_, i) => (
          <span key={i} className={i < stars ? "text-[#f5b301]" : "text-grey-200"}>
            ★
          </span>
        ))}
      </p>
      <p className="mt-2 text-[15px] font-bold text-grey-800">
        {stars === MAX_STARS ? "별을 모두 모았어요!" : `별 ${stars}개를 모았어요`}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-grey-500">
        끝까지 읽고 퀴즈 풀기 ★ · 퀴즈 {STAR_QUIZ_RATE * 100}% 이상 ★ · 요약 {STAR_SUMMARY_SCORE}점 이상 ★
      </p>
      {stars < MAX_STARS && <p className="mt-2 text-[13px] font-semibold text-grey-700">별 3개를 모으면 이 분야의 다음 기사가 열려요 🔓</p>}
      {quizRetry && (
        <>
          <Button variant="grey" size="sm" className="mt-3 bg-white" onClick={quizRetry.onClick}>
            퀴즈 다시 풀기
          </Button>
          <ErrorText>{quizRetry.error}</ErrorText>
        </>
      )}
    </div>
  );
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[14px]">
        <span className="text-grey-600">{label}</span>
        <span className="font-semibold text-grey-800">
          {value}
          <span className="font-normal text-grey-400"> / {max}</span>
        </span>
      </div>
      <ProgressBar value={value / max} className="mt-2" />
    </div>
  );
}

/** 완성한 요약에서 빈칸 낱말을 파랗게 칠한다 */
function MarkedWords({ text, words }: { text: string; words: string[] }) {
  const list = [...words].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!list.length) return <>{text}</>;
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${list.map(escape).join("|")})`));
  return (
    <>
      {parts.map((part, i) =>
        list.includes(part) ? (
          <span key={i} className="rounded bg-primary-weak px-0.5 font-bold text-primary-hover">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function FeedbackCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-2xl bg-grey-50 p-4">
      <p className="text-[14px] font-bold text-grey-800">
        {icon} {title}
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-grey-700">{text}</p>
    </div>
  );
}

function ResultStep({
  attempt,
  attemptsLeft,
  revealed,
  quizScore,
  nextHref,
  homeHref,
  stars,
  quizRetry,
  next,
  onRetry,
}: {
  attempt: SummaryAttempt;
  attemptsLeft: number;
  revealed: Revealed | null;
  quizScore: Score;
  nextHref: string | null;
  homeHref: string;
  /** 관심 분야 학습에서 이 기사로 모은 별 (반 학습지는 null) */
  stars: number | null;
  /** 관심 분야 학습에서 퀴즈 별을 아직 못 받았으면 다시 풀기 */
  quizRetry: { onClick: () => void; error: string } | null;
  next: { label: string; onClick: () => void } | null;
  onRetry: () => void;
}) {
  const { feedback } = attempt;
  const keyword = feedback.keyword;
  return (
    <>
      <div className={cn("animate-fade-up pb-44 pt-6", PAD)}>
        {/* 태블릿 가로: 왼쪽 점수, 오른쪽 피드백·내 요약 */}
        <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
          <div className="min-w-0">
            <p className="text-center text-[14px] font-semibold text-primary">요약 피드백</p>
            <h2 className="mt-1.5 text-center text-[24px] font-bold text-grey-900 md:text-[28px]">
              {scoreMessage(feedback.score)}
            </h2>
            <div className="mt-6 flex justify-center">
              <ScoreRing score={feedback.score} />
            </div>

            {stars !== null && <StarCard stars={stars} quizRetry={quizRetry} />}

            {keyword ? (
              <>
                <div className="mt-8 space-y-4 rounded-2xl border border-grey-100 p-5">
                  <ScoreRow label={`문단 키워드 (${keyword.paragraphs[0]}/${keyword.paragraphs[1]})`} value={feedback.breakdown.content} max={50} />
                  <ScoreRow label={`전체 요약 빈칸 (${keyword.summary[0]}/${keyword.summary[1]})`} value={feedback.breakdown.ownWords} max={30} />
                  <ScoreRow label="스스로 찾은 낱말" value={feedback.breakdown.sentence} max={20} />
                </div>
                <p className="mt-6 text-center text-[14px] text-grey-500">어휘 퀴즈 {quizScore.correct}/{quizScore.total}</p>
                <p className="mt-1 text-center text-[13px] text-grey-400">
                  빈칸을 처음이나 두 번째에 맞히면 점수가 올라가요. 힌트나 정답을 본 빈칸은 점수에 넣지 않아요.
                </p>
              </>
            ) : (
              <>
                <div className="mt-8 space-y-4 rounded-2xl border border-grey-100 p-5">
                  <ScoreRow label="핵심 내용" value={feedback.breakdown.content} max={50} />
                  <ScoreRow label="텍스트 재구성" value={feedback.breakdown.ownWords} max={30} />
                  <ScoreRow label="문장 완성도" value={feedback.breakdown.sentence} max={20} />
                </div>

                <p className="mt-6 text-center text-[14px] text-grey-500">
                  어휘 퀴즈 {quizScore.correct}/{quizScore.total}
                  {feedback.demo && " · 데모 모드에서는 간단한 규칙으로 채점해요"}
                </p>
                <p className="mt-1 text-center text-[13px] text-grey-400">
                  🤖 AI 선생님의 채점이라 틀릴 수도 있어요. 궁금하면 선생님께 물어보세요.
                </p>
              </>
            )}
          </div>

          <div className="min-w-0">
            <div className="mt-4 space-y-3 lg:mt-0">
              <FeedbackCard icon="👍" title="잘한 점" text={feedback.strengths} />
              <FeedbackCard icon="🔍" title={keyword ? "다시 볼 낱말" : "빠진 핵심 내용"} text={feedback.missing} />
              <FeedbackCard icon="💡" title="한 줄 조언" text={feedback.advice} />
            </div>

            <div className="mt-8">
              <p className="text-[15px] font-bold text-grey-800">{keyword ? "내가 완성한 요약" : "내가 쓴 요약"}</p>
              <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-grey-50 p-4 text-[15px] leading-relaxed text-grey-700">
                {keyword ? <MarkedWords text={attempt.text} words={keyword.words} /> : attempt.text}
              </p>
            </div>

            {revealed && (
              <details className="group mt-4 rounded-2xl border border-grey-100">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[15px] font-bold text-grey-800">
                  모범 요약과 핵심 내용 보기
                  <span className="text-grey-400 transition group-open:rotate-180">▾</span>
                </summary>
                <div className="space-y-4 px-4 pb-4">
                  <p className="text-[15px] leading-relaxed text-grey-700">{revealed.modelSummary}</p>
                  <ul className="space-y-1.5">
                    {revealed.keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-2 text-[14px] text-grey-600">
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>

      <BottomBar className={BAR}>
        <div className="flex gap-2 md:ml-auto md:max-w-lg">
          {attemptsLeft > 0 && (
            <Button size="lg" variant="grey" className="flex-1" onClick={onRetry}>
              {keyword ? "다시 하기" : "다시 쓰기"} ({attemptsLeft})
            </Button>
          )}
          {next ? (
            <Button size="lg" className="flex-1" onClick={next.onClick}>
              {next.label}
            </Button>
          ) : (
            <LinkButton href={nextHref ?? homeHref} size="lg" className="flex-1">
              {nextHref ? "다음 기사 읽기" : "목록으로"}
            </LinkButton>
          )}
        </div>
      </BottomBar>
    </>
  );
}

/* ───────────── 4단계: 생각 나누기 ───────────── */

function OpinionStep({
  worksheetId,
  article,
  gradeLevel,
  initial,
  onSubmitted,
}: {
  worksheetId: string;
  article: PublicArticle;
  gradeLevel: GradeLevel;
  initial: OpinionAnswer | null;
  onSubmitted: (data: { opinion: OpinionAnswer; board: OpinionBoard }) => void;
}) {
  const minChars = GRADES[gradeLevel].opinionMinChars;
  const [stance, setStance] = useState<number | null>(initial?.stance ?? null);
  const [text, setText] = useState(initial?.text ?? "");
  const [showArticle, setShowArticle] = useState(false);
  const [activeWord, setActiveWord] = useState<VocabItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const length = text.trim().length;

  async function submit() {
    setLoading(true);
    setError("");
    try {
      onSubmitted(
        await apiFetch<{ opinion: OpinionAnswer; board: OpinionBoard }>("/api/student/opinion", {
          body: { worksheetId, articleId: article.id, stance, text },
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <>
      <div className={cn("animate-fade-up pb-40 pt-4 md:pt-8", PAD)}>
        {/* 태블릿 가로: 왼쪽에 기사, 오른쪽에 생각 쓰기 */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-10">
          <ArticlePanel article={article} onWord={setActiveWord} />

          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-primary">생각 나누기</p>
            <h2 className="mt-1.5 text-[23px] font-bold leading-snug text-grey-900 md:text-[26px]">{article.opinionQuestion}</h2>
            <p className="mt-2 text-[14px] text-grey-500">정답은 없어요. 내 생각과 그렇게 생각한 까닭을 써 보세요.</p>

            {/* 태블릿에서는 입장 버튼을 가로로 나란히 */}
            <div className="mt-6 grid gap-2.5 md:grid-flow-col md:auto-cols-fr md:gap-3">
              {article.stances.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStance(i)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left text-[16px] font-semibold transition active:scale-[0.99]",
                    stance === i
                      ? "border-primary bg-primary-weak text-grey-900"
                      : "border-transparent bg-grey-50 text-grey-700 hover:bg-grey-100",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                      stance === i ? "border-primary bg-primary text-white" : "border-grey-300 bg-white",
                    )}
                  >
                    {stance === i && <CheckIcon className="size-3.5" />}
                  </span>
                  {label}
                </button>
              ))}
            </div>

            <p className="mt-7 text-[15px] font-bold text-grey-800">왜 그렇게 생각하나요?</p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_OPINION_CHARS))}
              rows={6}
              placeholder="기사 내용이나 내 경험을 근거로 까닭을 써 보세요."
              className="mt-2 resize-none"
            />
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className={cn("font-medium", length >= minChars ? "text-primary" : "text-grey-500")}>
                {length}자 {length < minChars && `· ${minChars}자 이상 써 주세요`}
              </span>
              <span className="text-grey-500">친구들에게는 이름 없이 보여요</span>
            </div>

            <div className={cn("lg:hidden", NO_SELECT)}>
              <ArticleToggle article={article} open={showArticle} onToggle={() => setShowArticle((v) => !v)} onWord={setActiveWord} />
            </div>
            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
            </div>
          </div>
        </div>
      </div>

      <Modal open={Boolean(activeWord)} onClose={() => setActiveWord(null)} title={activeWord?.word}>
        <p className="text-[17px] leading-relaxed text-grey-700">{activeWord?.meaning}</p>
      </Modal>

      <BottomBar className={BAR}>
        <Button
          size="lg"
          className="w-full md:ml-auto md:block md:max-w-md"
          disabled={stance === null || length < minChars}
          loading={loading}
          onClick={submit}
        >
          {initial ? "고친 생각 제출하기" : "제출하고 친구들 생각 보기"}
        </Button>
      </BottomBar>
    </>
  );
}

function OpinionCard({ stance, text, mine, hidden }: { stance: string; text: string; mine?: boolean; hidden?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-4", mine ? "bg-primary-weak" : "bg-grey-50")}>
      <Badge tone={mine ? "blue" : "grey"}>{stance}</Badge>
      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-grey-800">{text}</p>
      {hidden && <p className="mt-2 text-[12px] font-medium text-warning">선생님이 친구들에게 보이지 않게 했어요</p>}
    </div>
  );
}

function BoardStep({
  article,
  board,
  opinion,
  nextHref,
  onEdit,
  onShowFeedback,
}: {
  article: PublicArticle;
  board: OpinionBoard;
  opinion: OpinionAnswer;
  nextHref: string | null;
  onEdit: () => void;
  onShowFeedback: () => void;
}) {
  const total = board.counts.reduce((a, b) => a + b, 0);
  const others = board.items.filter((item) => !item.mine);

  return (
    <>
      <div className={cn("animate-fade-up pb-44 pt-4 md:pt-8", PAD)}>
        {/* 태블릿 가로: 왼쪽 결과·내 생각, 오른쪽 친구들 생각 */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-primary">우리 반 친구들의 생각</p>
            <h2 className="mt-1.5 text-[21px] font-bold leading-snug text-grey-900 md:text-[24px]">{article.opinionQuestion}</h2>

            <div className="mt-6 space-y-4 rounded-2xl border border-grey-100 p-5">
              {article.stances.map((label, i) => {
                const count = board.counts[i] ?? 0;
                const percent = total ? Math.round((count * 100) / total) : 0;
                const mine = opinion.stance === i;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-[14px]">
                      <span className={cn("font-semibold", mine ? "text-primary" : "text-grey-700")}>
                        {label}
                        {mine && <span className="ml-1.5 text-[12px] font-medium">· 내 선택</span>}
                      </span>
                      <span className="text-grey-500">
                        {count}명 · {percent}%
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-grey-100">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-700", mine ? "bg-primary" : "bg-grey-400")}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-[13px] text-grey-500">지금까지 {total}명이 생각을 나눴어요</p>
            </div>

            <p className="mt-7 text-[15px] font-bold text-grey-800">내 생각</p>
            <div className="mt-2">
              <OpinionCard stance={article.stances[opinion.stance]} text={opinion.text} mine hidden={opinion.hidden} />
            </div>

            <div className="mt-8 flex justify-center gap-4 text-[14px] font-medium text-grey-500 max-lg:hidden">
              <button type="button" onClick={onShowFeedback} className="hover:text-grey-800">
                요약 피드백 보기
              </button>
              <span className="text-grey-300">|</span>
              <button type="button" onClick={onEdit} className="hover:text-grey-800">
                내 생각 고치기
              </button>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mt-7 text-[15px] font-bold text-grey-800 lg:mt-0">친구들 생각 {others.length}개</p>
            {others.length === 0 ? (
              <p className="mt-2 rounded-2xl bg-grey-50 px-4 py-6 text-center text-[14px] leading-relaxed text-grey-500">
                아직 다른 친구의 생각이 없어요.
                <br />
                나중에 다시 와서 확인해 보세요!
              </p>
            ) : (
              <div className="mt-2 space-y-2.5">
                {others.map((item, i) => (
                  <OpinionCard key={i} stance={article.stances[item.stance]} text={item.text} />
                ))}
              </div>
            )}

            <div className="mt-8 flex justify-center gap-4 text-[14px] font-medium text-grey-500 lg:hidden">
              <button type="button" onClick={onShowFeedback} className="hover:text-grey-800">
                요약 피드백 보기
              </button>
              <span className="text-grey-300">|</span>
              <button type="button" onClick={onEdit} className="hover:text-grey-800">
                내 생각 고치기
              </button>
            </div>
          </div>
        </div>
      </div>

      <BottomBar className={BAR}>
        <LinkButton href={nextHref ?? "/s"} size="lg" className="w-full md:ml-auto md:flex md:max-w-md">
          {nextHref ? "다음 기사 읽기" : "이번 기사 학습 마치기"}
        </LinkButton>
      </BottomBar>
    </>
  );
}

/* ───────────── 학습 종료된 학습지: 기사와 내 기록만 보기 ───────────── */

function EndedView({
  article,
  homeHref,
  read,
  quizScore,
  latest,
  opinion,
}: {
  article: PublicArticle;
  homeHref: string;
  read: boolean;
  /** 퀴즈를 끝까지 풀었을 때만 점수를 보여 준다 */
  quizScore: Score | null;
  latest: SummaryAttempt | null;
  opinion: OpinionAnswer | null;
}) {
  const [activeWord, setActiveWord] = useState<VocabItem | null>(null);
  const studied = read || quizScore || latest || opinion;
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-white md:max-w-3xl lg:max-w-5xl">
      <header className="sticky top-0 z-30 flex h-14 items-center bg-white/95 px-2 backdrop-blur md:h-16 md:px-5 lg:px-9">
        <Link href={homeHref} className="rounded-full p-2 text-grey-800 hover:bg-grey-100" aria-label="목록으로">
          <ChevronLeft />
        </Link>
        <span className="flex-1 text-center text-[15px] font-semibold text-grey-700">학습 종료</span>
        <span className="w-10" />
      </header>

      <div className={cn("animate-fade-up pb-36 pt-4", PAD)}>
        <p className="rounded-2xl bg-grey-50 px-4 py-3 text-[14px] leading-relaxed text-grey-600">
          🔒 선생님이 학습을 마친 학습지예요. 기사와 내 기록은 볼 수 있지만, 더 풀거나 고칠 수는 없어요.
        </p>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-12">
          <article className="min-w-0">
            <div className="mt-6">
              <Badge tone="blue">{article.topic}</Badge>
            </div>
            <h1 className="mt-2.5 text-[23px] font-bold leading-snug text-grey-900 md:text-[28px]">{article.title}</h1>
            <div className="mt-5">
              <ArticleBody article={article} onWord={setActiveWord} />
            </div>
            <Sources sources={article.sources} />
          </article>

          <aside className="mt-10 min-w-0 lg:mt-6">
            <div className="space-y-4 lg:sticky lg:top-[88px]">
              <p className="text-[15px] font-bold text-grey-800">내 기록</p>
              {!studied ? (
                <p className="rounded-2xl bg-grey-50 px-4 py-6 text-center text-[14px] text-grey-500">
                  이 기사는 학습하지 않았어요.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={read ? "blue" : "grey"}>읽기 {read ? "완료" : "안 함"}</Badge>
                    <Badge tone={quizScore ? "blue" : "grey"}>
                      {quizScore ? `퀴즈 ${quizScore.correct}/${quizScore.total}` : "퀴즈 안 함"}
                    </Badge>
                    <Badge tone={latest ? "blue" : "grey"}>{latest ? `요약 ${latest.feedback.score}점` : "요약 안 함"}</Badge>
                  </div>
                  {latest && (
                    <>
                      <div>
                        <p className="text-[13px] font-semibold text-grey-500">{latest.feedback.keyword ? "내가 완성한 요약" : "내가 쓴 요약"}</p>
                        <p className="mt-1.5 whitespace-pre-wrap rounded-2xl bg-grey-50 p-4 text-[15px] leading-relaxed text-grey-700">
                          {latest.text}
                        </p>
                      </div>
                      <FeedbackCard icon="👍" title="잘한 점" text={latest.feedback.strengths} />
                      <FeedbackCard icon="💡" title="한 줄 조언" text={latest.feedback.advice} />
                    </>
                  )}
                  {opinion && article.stances[opinion.stance] !== undefined && (
                    <div>
                      <p className="text-[13px] font-semibold text-grey-500">내 생각</p>
                      <div className="mt-1.5">
                        <OpinionCard stance={article.stances[opinion.stance]} text={opinion.text} mine hidden={opinion.hidden} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      <Modal open={Boolean(activeWord)} onClose={() => setActiveWord(null)} title={activeWord?.word}>
        <p className="text-[17px] leading-relaxed text-grey-700">{activeWord?.meaning}</p>
        <Button size="lg" variant="grey" className="mt-6 w-full" onClick={() => setActiveWord(null)}>
          확인
        </Button>
      </Modal>

      <BottomBar className={BAR}>
        <LinkButton href={homeHref} size="lg" variant="grey" className="w-full md:ml-auto md:flex md:max-w-md">
          목록으로
        </LinkButton>
      </BottomBar>
    </div>
  );
}
