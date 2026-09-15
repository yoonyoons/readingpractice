"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  CheckIcon,
  ChevronLeft,
  EmptyState,
  Field,
  Input,
  Modal,
  Textarea,
} from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import type { Article, QuizItem, QuizType, SourceMode, Submission, Worksheet, WorksheetStatus } from "@/lib/types";
import {
  BLANK,
  cn,
  formatDate,
  formatDateTime,
  hasOpinionStep,
  latestSummary,
  QUIZ_TYPE_LABEL,
  quizResult,
} from "@/lib/utils";

interface StudentLite {
  id: string;
  number: number;
  name: string;
}

interface Props {
  classId: string;
  classTitle: string;
  gradeLabel: string;
  worksheet: Worksheet;
  students: StudentLite[];
  submissions: Submission[];
}

export function WorksheetView({ classId, classTitle, gradeLabel, worksheet, students, submissions }: Props) {
  const [tab, setTab] = useState<"edit" | "results">(worksheet.status === "published" ? "results" : "edit");

  return (
    <div>
      <Link
        href={`/teacher/classes/${classId}`}
        className="inline-flex items-center gap-1 text-[14px] font-medium text-grey-500 hover:text-grey-800"
      >
        <ChevronLeft className="size-4" />
        {classTitle}
      </Link>

      <div className="mt-4 flex w-fit rounded-2xl bg-grey-100 p-1">
        {(
          [
            ["edit", "학습지 내용"],
            ["results", "학생 결과"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "h-10 rounded-xl px-5 text-[15px] font-semibold transition",
              tab === key ? "bg-white text-grey-900 shadow-sm" : "text-grey-500 hover:text-grey-700",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭을 바꿔도 편집 중인 내용이 사라지지 않도록 둘 다 렌더링하고 숨긴다 */}
      <div className={tab === "edit" ? "" : "hidden"}>
        <WorksheetEditor
          classId={classId}
          gradeLabel={gradeLabel}
          worksheet={worksheet}
          hasSubmissions={submissions.length > 0}
        />
      </div>
      <div className={tab === "results" ? "" : "hidden"}>
        <ResultsPanel worksheet={worksheet} students={students} submissions={submissions} />
      </div>
    </div>
  );
}

/* ───────────── 편집 ───────────── */

type EditableArticle = Article & { bodyText: string };

const toEditable = (a: Article): EditableArticle => ({
  ...a,
  opinionQuestion: a.opinionQuestion ?? "",
  stances: a.stances ?? [],
  bodyText: a.paragraphs.join("\n\n"),
});

function fromEditable({ bodyText, ...article }: EditableArticle): Article {
  return {
    ...article,
    paragraphs: bodyText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
  };
}

const SOURCE_LABEL: Record<SourceMode, string> = {
  web: "웹 검색 기반",
  url: "붙여넣은 기사 기반",
  crawled: "원문 기사 기반",
  snippets: "기사 요약 기반",
  demo: "예시 기사 (데모)",
};

type Busy = null | "save" | "publish" | "unpublish" | "delete" | "regenerate";

function WorksheetEditor({
  classId,
  gradeLabel,
  worksheet,
  hasSubmissions,
}: {
  classId: string;
  gradeLabel: string;
  worksheet: Worksheet;
  hasSubmissions: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(worksheet.title);
  const [articles, setArticles] = useState(() => worksheet.articles.map(toEditable));
  const [status, setStatus] = useState<WorksheetStatus>(worksheet.status);
  const [active, setActive] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const article = articles[active];
  const readyCount = articles.filter((a) => a.status === "ready").length;

  function patchArticle(patch: Partial<EditableArticle>) {
    setArticles((prev) => prev.map((a, i) => (i === active ? { ...a, ...patch } : a)));
    setDirty(true);
  }

  async function persist(kind: "save" | "publish" | "unpublish") {
    setBusy(kind);
    setNotice(null);
    try {
      const body: Record<string, unknown> = { title, articles: articles.map(fromEditable) };
      if (kind === "publish") body.status = "published";
      if (kind === "unpublish") body.status = "draft";
      const { worksheet: saved } = await apiFetch<{ worksheet: Worksheet }>(`/api/worksheets/${worksheet.id}`, {
        method: "PATCH",
        body,
      });
      setStatus(saved.status);
      setDirty(false);
      setNotice({
        tone: "ok",
        text:
          kind === "publish"
            ? "학생들에게 배포했어요."
            : kind === "unpublish"
              ? "배포를 취소했어요. 학생 화면에서 사라져요."
              : "저장했어요.",
      });
      router.refresh();
    } catch (e) {
      setNotice({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    const target = article;
    const warn =
      status === "published" && hasSubmissions
        ? "\n\n이미 학습한 학생이 있어요. 다시 만들면 학생들의 퀴즈 기록이 새 문항과 맞지 않게 돼요."
        : "";
    if (!window.confirm(`'${target.topic}' 기사를 AI로 다시 만들까요?\n이 기사에서 고친 내용은 사라져요.${warn}`)) return;
    setBusy("regenerate");
    setNotice(null);
    try {
      const { article: fresh } = await apiFetch<{ article: Article }>(
        `/api/worksheets/${worksheet.id}/articles/${target.id}/regenerate`,
      );
      setArticles((prev) => prev.map((a) => (a.id === fresh.id ? toEditable(fresh) : a)));
      setNotice(
        fresh.status === "ready"
          ? { tone: "ok", text: "기사를 새로 만들었어요." }
          : { tone: "error", text: fresh.error ?? "기사를 만들지 못했어요." },
      );
      router.refresh();
    } catch (e) {
      setNotice({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("이 학습지를 삭제할까요?\n학생들의 학습 기록도 함께 지워지고 되돌릴 수 없어요.")) return;
    setBusy("delete");
    try {
      await apiFetch(`/api/worksheets/${worksheet.id}`, { method: "DELETE" });
      router.push(`/teacher/classes/${classId}`);
      router.refresh();
    } catch (e) {
      setNotice({ tone: "error", text: errorMessage(e) });
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge tone={status === "published" ? "green" : "grey"}>{status === "published" ? "배포 중" : "초안"}</Badge>
              <span className="text-[13px] text-grey-500">
                {gradeLabel} · 완성된 기사 {readyCount}개 · {formatDate(worksheet.createdAt)} 생성
              </span>
            </div>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              className="-mx-2 mt-2 w-full rounded-lg bg-transparent px-2 py-1 text-[24px] font-bold text-grey-900 outline-none transition hover:bg-grey-50 focus:bg-grey-50"
              aria-label="학습지 제목"
            />
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="ghost" onClick={remove} loading={busy === "delete"} disabled={Boolean(busy)}>
              삭제
            </Button>
            <Button variant="grey" onClick={() => persist("save")} loading={busy === "save"} disabled={!dirty || Boolean(busy)}>
              저장
            </Button>
            {status === "published" ? (
              <Button
                variant="secondary"
                onClick={() => persist("unpublish")}
                loading={busy === "unpublish"}
                disabled={Boolean(busy)}
              >
                배포 취소
              </Button>
            ) : (
              <Button
                onClick={() => persist("publish")}
                loading={busy === "publish"}
                disabled={Boolean(busy) || readyCount === 0}
              >
                {dirty ? "저장하고 배포하기" : "학생에게 배포하기"}
              </Button>
            )}
          </div>
        </div>

        {notice && (
          <p className={cn("mt-3 text-[14px] font-medium", notice.tone === "error" ? "text-danger" : "text-success")}>
            {notice.text}
          </p>
        )}
        {status === "draft" && (
          <p className="mt-4 rounded-xl bg-grey-50 px-4 py-3 text-[14px] leading-relaxed text-grey-600">
            AI가 만든 내용이에요. 사실과 다른 내용, 어색한 표현, 헷갈리는 보기가 없는지 확인한 뒤 배포해 주세요.
          </p>
        )}
        {status === "published" && hasSubmissions && (
          <p className="mt-4 rounded-xl bg-warning-weak px-4 py-3 text-[14px] leading-relaxed text-[#8a5300]">
            이미 학습한 학생이 있어요. 저장하면 학생 화면에 바로 반영되고, 퀴즈 정답을 바꾸면 기존 기록과 맞지 않을 수
            있어요.
          </p>
        )}
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {articles.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold transition",
              i === active ? "bg-grey-900 text-white" : "bg-white text-grey-600 hover:bg-grey-100",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                a.status === "ready" ? "bg-success" : a.status === "failed" ? "bg-danger" : "bg-grey-400",
              )}
            />
            {i + 1}. {a.topic}
          </button>
        ))}
      </div>

      {article &&
        (article.status !== "ready" ? (
          <Card>
            <EmptyState
              icon={article.status === "failed" ? "⚠️" : "⏳"}
              title={article.status === "failed" ? "이 기사를 만들지 못했어요" : "기사를 아직 만들지 못했어요"}
              description={article.error ?? "다시 만들기를 눌러 주세요."}
              action={
                <Button onClick={regenerate} loading={busy === "regenerate"} disabled={Boolean(busy)}>
                  다시 만들기
                </Button>
              }
            />
          </Card>
        ) : (
          <ArticleForm
            key={article.id}
            article={article}
            onChange={patchArticle}
            onRegenerate={regenerate}
            regenerating={busy === "regenerate"}
            disabled={Boolean(busy)}
          />
        ))}
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-[17px] font-bold text-grey-900">{title}</h3>
      {action}
    </div>
  );
}

function ArticleForm({
  article,
  onChange,
  onRegenerate,
  regenerating,
  disabled,
}: {
  article: EditableArticle;
  onChange: (patch: Partial<EditableArticle>) => void;
  onRegenerate: () => void;
  regenerating: boolean;
  disabled: boolean;
}) {
  const updateQuiz = (index: number, patch: Partial<QuizItem>) =>
    onChange({ quiz: article.quiz.map((q, i) => (i === index ? { ...q, ...patch } : q)) });
  const bodyChars = article.bodyText.replace(/\s/g, "").length;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <Card>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge tone="blue">{article.topic}</Badge>
            <Badge tone={article.sourceMode === "snippets" ? "orange" : "grey"}>{SOURCE_LABEL[article.sourceMode]}</Badge>
            {article.sourceMode !== "demo" && (
              <span className="text-[13px] text-grey-500">출처 {article.sources.length}곳</span>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto"
              onClick={onRegenerate}
              loading={regenerating}
              disabled={disabled}
            >
              AI로 다시 만들기
            </Button>
          </div>
          <div className="space-y-4">
            <Field label="제목">
              <Input compact value={article.title} onChange={(e) => onChange({ title: e.target.value })} />
            </Field>
            <Field label="왜 알아야 할까요?">
              <Textarea compact rows={2} value={article.whyItMatters} onChange={(e) => onChange({ whyItMatters: e.target.value })} />
            </Field>
            <Field label="본문" hint={`빈 줄로 문단을 나눠요 · 공백 제외 ${bodyChars}자`}>
              <Textarea compact rows={18} value={article.bodyText} onChange={(e) => onChange({ bodyText: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle
            title={`퀴즈 ${article.quiz.length}문항`}
            action={
              <Button
                variant="grey"
                size="sm"
                onClick={() =>
                  onChange({
                    quiz: [
                      ...article.quiz,
                      {
                        id: crypto.randomUUID(),
                        type: "comprehension",
                        prompt: "",
                        sentence: "",
                        target: "",
                        choices: ["", "", "", ""],
                        answer: 0,
                        explanation: "",
                      },
                    ],
                  })
                }
              >
                + 문항 추가
              </Button>
            }
          />
          <div className="space-y-3">
            {article.quiz.map((item, i) => (
              <QuizItemEditor
                key={item.id}
                item={item}
                index={i}
                onChange={(patch) => updateQuiz(i, patch)}
                onRemove={() => onChange({ quiz: article.quiz.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <SectionTitle
            title="핵심 어휘"
            action={
              <Button variant="grey" size="sm" onClick={() => onChange({ vocab: [...article.vocab, { word: "", meaning: "" }] })}>
                + 추가
              </Button>
            }
          />
          <p className="-mt-2 mb-3 text-[13px] text-grey-500">본문에서 파란색으로 표시되고, 누르면 뜻이 보여요.</p>
          <div className="space-y-3">
            {article.vocab.map((v, i) => (
              <div key={i} className="rounded-2xl bg-grey-50 p-3">
                <div className="flex gap-2">
                  <Input
                    compact
                    value={v.word}
                    placeholder="낱말"
                    className="bg-white"
                    onChange={(e) =>
                      onChange({ vocab: article.vocab.map((x, j) => (j === i ? { ...x, word: e.target.value } : x)) })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11"
                    onClick={() => onChange({ vocab: article.vocab.filter((_, j) => j !== i) })}
                  >
                    삭제
                  </Button>
                </div>
                <Textarea
                  compact
                  rows={2}
                  value={v.meaning}
                  placeholder="뜻"
                  className="mt-2 bg-white"
                  onChange={(e) =>
                    onChange({ vocab: article.vocab.map((x, j) => (j === i ? { ...x, meaning: e.target.value } : x)) })
                  }
                />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="요약 채점 기준"
            action={
              <Button variant="grey" size="sm" onClick={() => onChange({ keyPoints: [...article.keyPoints, ""] })}>
                + 추가
              </Button>
            }
          />
          <p className="-mt-2 mb-3 text-[13px] text-grey-500">AI가 학생 요약을 채점할 때 이 핵심 내용을 기준으로 삼아요.</p>
          <div className="space-y-2">
            {article.keyPoints.map((point, i) => (
              <div key={i} className="flex gap-2">
                <Textarea
                  compact
                  rows={2}
                  value={point}
                  onChange={(e) => onChange({ keyPoints: article.keyPoints.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ keyPoints: article.keyPoints.filter((_, j) => j !== i) })}
                >
                  삭제
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Field label="모범 요약" hint="학생이 요약을 제출한 뒤에 보여줘요.">
              <Textarea compact rows={4} value={article.modelSummary} onChange={(e) => onChange({ modelSummary: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="생각 나누기"
            action={
              article.stances.length < 3 ? (
                <Button variant="grey" size="sm" onClick={() => onChange({ stances: [...article.stances, ""] })}>
                  + 입장
                </Button>
              ) : undefined
            }
          />
          <p className="-mt-2 mb-3 text-[13px] leading-relaxed text-grey-500">
            요약 뒤에 학생이 입장을 고르고 까닭을 써요. 제출한 학생은 친구들 생각을 이름 없이 볼 수 있어요. 질문을 비우면
            이 단계를 건너뛰어요.
          </p>
          <Field label="질문">
            <Textarea
              compact
              rows={2}
              value={article.opinionQuestion}
              onChange={(e) => onChange({ opinionQuestion: e.target.value })}
            />
          </Field>
          <div className="mt-3 space-y-2">
            {article.stances.map((stance, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  compact
                  value={stance}
                  placeholder={`입장 ${i + 1}`}
                  onChange={(e) => onChange({ stances: article.stances.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11"
                  onClick={() => onChange({ stances: article.stances.filter((_, j) => j !== i) })}
                >
                  삭제
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {article.sources.length > 0 && (
          <Card>
            <SectionTitle title="참고한 기사" />
            <ul className="space-y-2.5">
              {article.sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="group block">
                    <span className="line-clamp-2 text-[14px] font-medium text-grey-700 group-hover:underline">{s.title}</span>
                    <span className="text-[12px] text-grey-400">{formatDateTime(s.pubDate)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function QuizItemEditor({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: QuizItem;
  index: number;
  onChange: (patch: Partial<QuizItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-grey-200 p-4">
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-bold text-grey-800">Q{index + 1}</span>
        <select
          value={item.type}
          onChange={(e) => onChange({ type: e.target.value as QuizType })}
          className="h-9 rounded-lg bg-grey-100 px-2 text-[14px] font-medium text-grey-700 outline-none"
        >
          {(Object.keys(QUIZ_TYPE_LABEL) as QuizType[]).map((t) => (
            <option key={t} value={t}>
              {QUIZ_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <button type="button" onClick={onRemove} className="ml-auto text-[13px] font-medium text-grey-400 hover:text-danger">
          삭제
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        <Input compact value={item.prompt} onChange={(e) => onChange({ prompt: e.target.value })} placeholder="질문" />
        {item.type !== "comprehension" && (
          <Textarea
            compact
            rows={2}
            value={item.sentence}
            onChange={(e) => onChange({ sentence: e.target.value })}
            placeholder={item.type === "blank" ? `기사 문장 (빈칸 자리에 ${BLANK} 입력)` : "기사 문장"}
          />
        )}
        {item.type === "synonym" && (
          <Input
            compact
            value={item.target}
            onChange={(e) => onChange({ target: e.target.value })}
            placeholder="밑줄 칠 낱말 (문장 속 글자 그대로)"
          />
        )}
        <div className="space-y-2">
          {item.choices.map((choice, ci) => (
            <div key={ci} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ answer: ci })}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold transition",
                  item.answer === ci ? "border-success bg-success text-white" : "border-grey-300 text-grey-400 hover:border-grey-400",
                )}
                aria-label={`${ci + 1}번을 정답으로`}
                title="정답으로 지정"
              >
                {item.answer === ci ? <CheckIcon className="size-3.5" /> : ci + 1}
              </button>
              <Input
                compact
                value={choice}
                onChange={(e) => onChange({ choices: item.choices.map((c, j) => (j === ci ? e.target.value : c)) })}
                placeholder={`보기 ${ci + 1}`}
              />
            </div>
          ))}
        </div>
        <Textarea
          compact
          rows={2}
          value={item.explanation}
          onChange={(e) => onChange({ explanation: e.target.value })}
          placeholder="해설 (학생이 답을 고른 뒤 보여줘요)"
        />
      </div>
    </div>
  );
}

/* ───────────── 학생 결과 ───────────── */

function ResultsPanel({
  worksheet,
  students,
  submissions,
}: {
  worksheet: Worksheet;
  students: StudentLite[];
  submissions: Submission[];
}) {
  const articles = worksheet.articles.filter((a) => a.status === "ready");
  const subMap = useMemo(() => new Map(submissions.map((s) => [`${s.studentId}:${s.articleId}`, s])), [submissions]);
  const [detail, setDetail] = useState<{ student: StudentLite; article: Article } | null>(null);

  if (worksheet.status !== "published" && submissions.length === 0) {
    return (
      <Card className="mt-5">
        <EmptyState icon="📮" title="아직 배포하지 않았어요" description="학습지를 배포하면 학생들의 완독·퀴즈·요약·생각 나누기 결과가 여기에 모여요." />
      </Card>
    );
  }
  if (students.length === 0) {
    return (
      <Card className="mt-5">
        <EmptyState icon="🙋" title="아직 입장한 학생이 없어요" description="반 코드를 알려 주면 학생들이 입장할 수 있어요." />
      </Card>
    );
  }

  const stats = articles.map((article) => {
    const subs = students
      .map((s) => subMap.get(`${s.id}:${article.id}`))
      .filter((s): s is Submission => Boolean(s));
    const quizDone = subs.filter((s) => article.quiz.length > 0 && article.quiz.every((q) => s.quizAnswers[q.id]));
    const scores = subs.map((s) => latestSummary(s)?.feedback.score).filter((x): x is number => x !== undefined);
    return {
      article,
      read: subs.filter((s) => s.readAt).length,
      quizAvg: quizDone.length
        ? Math.round((100 * quizDone.reduce((sum, s) => sum + quizResult(article, s).correct / article.quiz.length, 0)) / quizDone.length)
        : null,
      summaryAvg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      opinions: hasOpinionStep(article) ? subs.filter((s) => s.opinion).length : null,
    };
  });

  function downloadCsv() {
    const header = [
      "번호",
      "이름",
      ...articles.flatMap((_, i) => [
        `기사${i + 1} 완독`,
        `기사${i + 1} 퀴즈`,
        `기사${i + 1} 요약점수`,
        `기사${i + 1} 요약문`,
        `기사${i + 1} 입장`,
        `기사${i + 1} 생각`,
      ]),
    ];
    const rows = students.map((s) => [
      s.number,
      s.name,
      ...articles.flatMap((a) => {
        const sub = subMap.get(`${s.id}:${a.id}`);
        const q = quizResult(a, sub);
        const summary = latestSummary(sub);
        return [
          sub?.readAt ? "O" : "",
          q.answered ? `${q.correct}/${q.total}` : "",
          summary?.feedback.score ?? "",
          summary?.text ?? "",
          sub?.opinion ? (a.stances[sub.opinion.stance] ?? "") : "",
          sub?.opinion?.text ?? "",
        ];
      }),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    // 엑셀에서 한글이 깨지지 않도록 BOM을 붙인다
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${worksheet.title}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {stats.map((s, i) => (
          <Card key={s.article.id} className="p-5">
            <p className="truncate text-[14px] font-semibold text-grey-500">
              {i + 1}. {s.article.topic}
            </p>
            <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
              <Stat label="완독" value={`${s.read}/${students.length}`} />
              <Stat label="퀴즈" value={s.quizAvg === null ? "-" : `${s.quizAvg}%`} />
              <Stat label="요약" value={s.summaryAvg === null ? "-" : `${s.summaryAvg}점`} />
              <Stat label="생각" value={s.opinions === null ? "-" : `${s.opinions}명`} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-[17px] font-bold">학생별 결과</h3>
          <Button variant="grey" size="sm" onClick={downloadCsv}>
            엑셀(CSV) 내려받기
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[14px]">
            <thead>
              <tr className="border-y border-grey-100 bg-grey-50 text-left text-[13px] text-grey-500">
                <th className="w-16 px-5 py-3 font-medium">번호</th>
                <th className="w-28 px-3 py-3 font-medium">이름</th>
                {articles.map((a, i) => (
                  <th key={a.id} className="px-3 py-3 font-medium">
                    <span className="line-clamp-1">
                      {i + 1}. {a.topic}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-grey-100 last:border-0">
                  <td className="px-5 py-2.5 text-grey-500">{s.number}</td>
                  <td className="px-3 py-2.5 font-semibold text-grey-800">{s.name}</td>
                  {articles.map((a) => (
                    <td key={a.id} className="px-2 py-1.5">
                      <ResultCell
                        article={a}
                        sub={subMap.get(`${s.id}:${a.id}`)}
                        onClick={() => setDetail({ student: s, article: a })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.student.number}번 ${detail.student.name}` : undefined}
        wide
      >
        {detail && (
          <StudentDetail
            worksheetId={worksheet.id}
            studentId={detail.student.id}
            article={detail.article}
            sub={subMap.get(`${detail.student.id}:${detail.article.id}`)}
          />
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-grey-50 px-1 py-2.5">
      <p className="text-[12px] text-grey-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-bold text-grey-900">{value}</p>
    </div>
  );
}

function ResultCell({ article, sub, onClick }: { article: Article; sub: Submission | undefined; onClick: () => void }) {
  if (!sub) return <span className="px-2 text-grey-300">-</span>;
  const q = quizResult(article, sub);
  const summary = latestSummary(sub);
  return (
    <button type="button" onClick={onClick} className="flex flex-wrap items-center gap-1 rounded-lg px-2 py-1.5 text-left hover:bg-grey-100">
      {sub.readAt && <Badge tone="blue">완독</Badge>}
      {q.answered > 0 && (
        <Badge tone="grey">
          퀴즈 {q.correct}/{q.total}
        </Badge>
      )}
      {summary && (
        <Badge tone={summary.feedback.score >= 80 ? "green" : summary.feedback.score >= 50 ? "orange" : "red"}>
          요약 {summary.feedback.score}점
        </Badge>
      )}
      {sub.opinion && <Badge tone={sub.opinion.hidden ? "orange" : "grey"}>생각 ✓</Badge>}
    </button>
  );
}

function StudentDetail({
  worksheetId,
  studentId,
  article,
  sub,
}: {
  worksheetId: string;
  studentId: string;
  article: Article;
  sub: Submission | undefined;
}) {
  if (!sub) return <p className="text-[15px] text-grey-500">아직 이 기사를 시작하지 않았어요.</p>;
  const q = quizResult(article, sub);

  return (
    <div className="space-y-6">
      <p className="text-[15px] font-semibold text-grey-600">{article.title}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="완독" value={sub.readAt ? formatDateTime(sub.readAt) : "-"} />
        <Stat label="퀴즈" value={q.answered ? `${q.correct}/${q.total}` : "-"} />
        <Stat label="요약 제출" value={`${sub.summaries.length}회`} />
      </div>

      <section>
        <h4 className="text-[16px] font-bold text-grey-900">퀴즈</h4>
        <ul className="mt-2 space-y-2">
          {article.quiz.map((item, i) => {
            const a = sub.quizAnswers[item.id];
            return (
              <li key={item.id} className="flex items-start gap-2.5 text-[14px]">
                <span className={cn("mt-px w-4 shrink-0 font-bold", !a ? "text-grey-300" : a.correct ? "text-success" : "text-danger")}>
                  {!a ? "·" : a.correct ? "O" : "X"}
                </span>
                <span className="text-grey-700">
                  Q{i + 1}. {item.prompt}
                  {a && !a.correct && (
                    <span className="block text-[13px] text-grey-500">
                      고른 답: {item.choices[a.choice]} → 정답: {item.choices[item.answer]}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h4 className="text-[16px] font-bold text-grey-900">요약</h4>
        {sub.summaries.length === 0 ? (
          <p className="mt-2 text-[14px] text-grey-500">아직 제출하지 않았어요.</p>
        ) : (
          [...sub.summaries].reverse().map((s, i) => (
            <div key={s.submittedAt} className="mt-3 rounded-2xl bg-grey-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-grey-500">
                  {sub.summaries.length - i}번째 제출 · {formatDateTime(s.submittedAt)}
                </span>
                <span className="text-[18px] font-bold text-primary">{s.feedback.score}점</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-grey-800">{s.text}</p>
              <div className="mt-3 space-y-1 border-t border-grey-200 pt-3 text-[13px] leading-relaxed text-grey-600">
                <p>
                  핵심 내용 {s.feedback.breakdown.content}/50 · 내 말로 표현 {s.feedback.breakdown.ownWords}/30 · 문장 완성도{" "}
                  {s.feedback.breakdown.sentence}/20
                </p>
                <p>👍 {s.feedback.strengths}</p>
                <p>🔍 {s.feedback.missing}</p>
                <p>💡 {s.feedback.advice}</p>
              </div>
            </div>
          ))
        )}
      </section>

      {hasOpinionStep(article) && (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-[16px] font-bold text-grey-900">생각 나누기</h4>
            {sub.opinion && (
              <OpinionHideButton
                worksheetId={worksheetId}
                articleId={article.id}
                studentId={studentId}
                hidden={sub.opinion.hidden}
              />
            )}
          </div>
          {sub.opinion ? (
            <div className="mt-3 rounded-2xl bg-grey-50 p-4">
              <p className="text-[13px] text-grey-500">{article.opinionQuestion}</p>
              <div className="mt-2">
                <Badge tone="blue">{article.stances[sub.opinion.stance]}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-grey-800">{sub.opinion.text}</p>
              {sub.opinion.hidden && (
                <p className="mt-2 text-[13px] font-medium text-warning">친구들에게 보이지 않게 숨긴 의견이에요.</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[14px] text-grey-500">아직 쓰지 않았어요.</p>
          )}
        </section>
      )}
    </div>
  );
}

function OpinionHideButton({
  worksheetId,
  articleId,
  studentId,
  hidden,
}: {
  worksheetId: string;
  articleId: string;
  studentId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await apiFetch(`/api/worksheets/${worksheetId}/opinions`, {
        method: "PATCH",
        body: { articleId, studentId, hidden: !hidden },
      });
      router.refresh();
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant={hidden ? "secondary" : "grey"} size="sm" onClick={toggle} loading={loading}>
      {hidden ? "다시 보이기" : "친구들에게 숨기기"}
    </Button>
  );
}
