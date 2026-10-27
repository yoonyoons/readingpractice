"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  CheckIcon,
  ErrorText,
  ChevronLeft,
  ChevronRight,
  EmptyState,
  Field,
  Input,
  Modal,
  Spinner,
  Textarea,
} from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import { MAX_ARTICLES_PER_WORKSHEET } from "@/lib/grades";
import type { Article, QuizItem, QuizType, SourceItem, SourceMode, Submission, Worksheet, WorksheetStatus } from "@/lib/types";
import { WORKSHEET_STATUS_BADGE } from "./WorksheetList";
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
  const [tab, setTab] = useState<"edit" | "results">(worksheet.status !== "draft" ? "results" : "edit");

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

/** 선택한 기사 탭 안의 작은 버튼 (옮기기·빼기) */
function TabTool({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-8 items-center justify-center rounded-lg text-[12px] text-white/70 transition hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** 기사 추가: 기사 주소(또는 본문)를 붙여넣으면 이 반 학년군에 맞춘 기사를 만들어 학습지 끝에 넣는다 */
function AddArticleButton({
  gradeLabel,
  busy,
  onAdd,
}: {
  gradeLabel: string;
  busy: Busy;
  /** 실패하면 오류 문구를 돌려준다 */
  onAdd: (input: { url: string; text: string }) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [paste, setPaste] = useState(false);
  const [error, setError] = useState("");
  const adding = busy === "add";

  function close() {
    if (adding) return;
    setOpen(false);
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = { url: url.trim(), text: paste ? text.trim() : "" };
    if (!input.url && !input.text) {
      setError(paste ? "기사 본문을 붙여넣어 주세요." : "기사 주소(URL)를 붙여넣어 주세요.");
      return;
    }
    setError("");
    const message = await onAdd(input);
    if (message) {
      setError(message);
      // 주소로 본문을 못 가져오면 서버가 붙여넣기를 안내하므로 본문 칸을 연다
      if (message.includes("본문 직접 붙여넣기")) setPaste(true);
      return;
    }
    setOpen(false);
    setUrl("");
    setText("");
    setPaste(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={Boolean(busy)}
        className="flex shrink-0 items-center gap-1 rounded-2xl border border-dashed border-grey-300 px-4 py-3 text-[15px] font-semibold text-grey-600 transition hover:border-primary hover:text-primary disabled:opacity-50"
      >
        ＋ 기사 추가
      </button>
      <Modal open={open} onClose={adding ? undefined : close} title={adding ? "기사를 만들고 있어요" : "기사 추가"}>
        {adding ? (
          <div className="flex items-start gap-3">
            <Spinner className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-[15px] font-semibold text-grey-800">기사를 읽고 {gradeLabel} 수준으로 다시 쓰는 중</p>
              <p className="mt-1 text-[13px] leading-relaxed text-grey-500">
                기사 분석 → 기사·어휘·퀴즈 작성 순서로 진행돼요. 1~2분 정도 걸리니 창을 닫지 말고 기다려 주세요.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-[14px] leading-relaxed text-grey-600">
              수업에 쓰고 싶은 기사 주소를 붙여넣으면 AI가 {gradeLabel} 수준의 기사·어휘·퀴즈로 만들어 학습지 끝에 넣어요.
              학습지 하나에는 기사를 {MAX_ARTICLES_PER_WORKSHEET}개까지 넣을 수 있어요.
            </p>
            <Input
              compact
              inputMode="url"
              autoComplete="off"
              aria-label="기사 주소(URL)"
              placeholder="https://www.example.co.kr/news/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            {paste ? (
              <Textarea
                compact
                rows={7}
                aria-label="기사 본문"
                placeholder="기사 본문을 복사해 붙여넣어 주세요"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setPaste(true)}
                className="text-[13px] font-medium text-grey-500 underline underline-offset-2 hover:text-grey-700"
              >
                본문 직접 붙여넣기
              </button>
            )}
            {error && <ErrorText>{error}</ErrorText>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                취소
              </Button>
              <Button type="submit">만들기</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

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

type Busy = null | "save" | "publish" | "unpublish" | "end" | "delete" | "regenerate" | "add";

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

  async function persist(kind: "save" | "publish" | "unpublish" | "end") {
    setBusy(kind);
    setNotice(null);
    try {
      const body: Record<string, unknown> = { title, articles: articles.map(fromEditable) };
      if (kind === "publish") body.status = "published";
      if (kind === "unpublish") body.status = "draft";
      if (kind === "end") body.status = "ended";
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
            : kind === "end"
              ? "학습을 종료했어요. 학생들은 기록만 볼 수 있어요."
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
      status !== "draft" && hasSubmissions
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

  /** 선택한 기사를 앞(-1)이나 뒤(+1)로 옮긴다. 저장을 눌러야 반영된다 */
  function moveArticle(dir: -1 | 1) {
    const to = active + dir;
    if (to < 0 || to >= articles.length) return;
    setArticles((prev) => {
      const next = [...prev];
      [next[active], next[to]] = [next[to], next[active]];
      return next;
    });
    setActive(to);
    setDirty(true);
  }

  /** 선택한 기사를 학습지에서 뺀다. 저장을 눌러야 반영된다 */
  function deleteArticle() {
    if (articles.length <= 1) return;
    const warn =
      status !== "draft" && hasSubmissions ? "\n이 기사를 학습한 학생들의 기록은 결과에서 보이지 않게 돼요." : "";
    if (!window.confirm(`'${article.topic}' 기사를 학습지에서 뺄까요?\n저장을 눌러야 반영돼요.${warn}`)) return;
    setArticles((prev) => prev.filter((_, i) => i !== active));
    setActive(Math.max(0, Math.min(active, articles.length - 2)));
    setDirty(true);
  }

  /** 붙여넣은 기사로 새 기사를 만들어 끝에 넣는다. 서버가 만들자마자 저장한다 */
  async function addArticle(input: { url: string; text: string }) {
    setBusy("add");
    setNotice(null);
    try {
      const { article: added } = await apiFetch<{ article: Article }>(`/api/worksheets/${worksheet.id}/articles`, {
        body: input,
      });
      setArticles((prev) => [...prev, toEditable(added)]);
      setActive(articles.length);
      setNotice(
        added.status === "ready"
          ? { tone: "ok", text: `${articles.length + 1}번째 기사를 추가했어요.` }
          : { tone: "error", text: added.error ?? "기사를 만들지 못했어요." },
      );
      router.refresh();
      return null;
    } catch (e) {
      return errorMessage(e);
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
              <Badge tone={WORKSHEET_STATUS_BADGE[status].tone}>{WORKSHEET_STATUS_BADGE[status].label}</Badge>
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
              <>
                <Button
                  variant="secondary"
                  onClick={() => persist("unpublish")}
                  loading={busy === "unpublish"}
                  disabled={Boolean(busy)}
                >
                  배포 취소
                </Button>
                <Button
                  variant="grey"
                  onClick={() => {
                    if (window.confirm("학습을 종료할까요?\n학생들은 기사와 자기 기록만 볼 수 있고 더 풀 수 없어요.")) persist("end");
                  }}
                  loading={busy === "end"}
                  disabled={Boolean(busy)}
                >
                  학습 종료
                </Button>
              </>
            ) : status === "ended" ? (
              <Button onClick={() => persist("publish")} loading={busy === "publish"} disabled={Boolean(busy) || readyCount === 0}>
                {dirty ? "저장하고 다시 배포하기" : "다시 배포하기"}
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
        {status === "ended" && (
          <p className="mt-4 rounded-xl bg-warning-weak px-4 py-3 text-[14px] leading-relaxed text-[#8a5300]">
            학습을 종료한 학습지예요. 학생들은 기사와 자기 기록만 볼 수 있고 더 풀 수 없어요.
          </p>
        )}
        {status === "published" && hasSubmissions && (
          <p className="mt-4 rounded-xl bg-warning-weak px-4 py-3 text-[14px] leading-relaxed text-[#8a5300]">
            이미 학습한 학생이 있어요. 저장하면 학생 화면에 바로 반영되고, 퀴즈 정답을 바꾸면 기존 기록과 맞지 않을 수
            있어요.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {articles.map((a, i) => (
          <div
            key={a.id}
            className={cn(
              "flex shrink-0 items-center rounded-2xl transition",
              i === active ? "bg-grey-900 text-white" : "bg-white text-grey-600 hover:bg-grey-100",
            )}
          >
            <button
              type="button"
              onClick={() => setActive(i)}
              className="flex items-center gap-2 px-4 py-3 text-[15px] font-semibold"
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  a.status === "ready" ? "bg-success" : a.status === "failed" ? "bg-danger" : "bg-grey-400",
                )}
              />
              {i + 1}. {a.topic}
            </button>
            {i === active && (
              <div className="flex items-center pr-2">
                <TabTool label="앞으로 옮기기" onClick={() => moveArticle(-1)} disabled={Boolean(busy) || i === 0}>
                  ◀
                </TabTool>
                <TabTool
                  label="뒤로 옮기기"
                  onClick={() => moveArticle(1)}
                  disabled={Boolean(busy) || i === articles.length - 1}
                >
                  ▶
                </TabTool>
                <TabTool label="기사 빼기" onClick={deleteArticle} disabled={Boolean(busy) || articles.length <= 1}>
                  ✕
                </TabTool>
              </div>
            )}
          </div>
        ))}
        {articles.length < MAX_ARTICLES_PER_WORKSHEET && (
          <AddArticleButton gradeLabel={gradeLabel} busy={busy} onAdd={addArticle} />
        )}
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
  // 퀴즈는 한 번에 한 문항만 보여 준다
  const [quizId, setQuizId] = useState(article.quiz[0]?.id);
  const quizIndex = Math.max(0, article.quiz.findIndex((q) => q.id === quizId));
  const selectedQuiz = article.quiz[quizIndex];
  // 문항을 바꾸거나 새로 추가하면 렌더링된 뒤에 그 문항으로 이동한다
  const pendingJump = useRef<string | null>(null);

  function selectQuiz(id: string) {
    setQuizId(id);
    pendingJump.current = quizAnchor(id);
  }

  function removeQuiz(index: number) {
    const next = article.quiz[index + 1] ?? article.quiz[index - 1];
    onChange({ quiz: article.quiz.filter((_, j) => j !== index) });
    if (next) setQuizId(next.id);
  }

  useEffect(() => {
    if (!pendingJump.current) return;
    jumpTo(pendingJump.current);
    pendingJump.current = null;
  });

  function addQuiz() {
    const id = crypto.randomUUID();
    onChange({
      quiz: [
        ...article.quiz,
        {
          id,
          type: "comprehension",
          prompt: "",
          sentence: "",
          target: "",
          choices: ["", "", "", ""],
          answer: 0,
          explanation: "",
        },
      ],
    });
    selectQuiz(id);
  }

  const navItems: NavItem[] = [
    { id: "edit-body", label: "본문" },
    ...article.quiz.map((q, i) => ({ id: quizAnchor(q.id), label: `Q${i + 1}`, incomplete: isQuizIncomplete(q), quiz: true })),
    { id: "edit-vocab", label: "핵심 어휘" },
    { id: "edit-keypoints", label: "요약 기준" },
    { id: "edit-opinion", label: "생각 나누기" },
  ];

  return (
    <div className="space-y-5">
      <JumpBar
        items={navItems}
        selectedQuiz={selectedQuiz ? quizAnchor(selectedQuiz.id) : undefined}
        onSelectQuiz={(anchor) => selectQuiz(anchor.slice(QUIZ_ANCHOR_PREFIX.length))}
        onAddQuiz={addQuiz}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card id="edit-body" className={ANCHOR}>
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
                <Button variant="grey" size="sm" onClick={addQuiz}>
                  + 문항 추가
                </Button>
              }
            />
            {selectedQuiz ? (
              <>
                <QuizItemEditor
                  key={selectedQuiz.id}
                  item={selectedQuiz}
                  index={quizIndex}
                  onChange={(patch) => updateQuiz(quizIndex, patch)}
                  onRemove={() => removeQuiz(quizIndex)}
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button
                    variant="grey"
                    size="sm"
                    disabled={quizIndex === 0}
                    onClick={() => selectQuiz(article.quiz[quizIndex - 1].id)}
                  >
                    ← 이전 문항
                  </Button>
                  <span className="text-[13px] font-medium text-grey-500">
                    {quizIndex + 1} / {article.quiz.length}
                  </span>
                  <Button
                    variant="grey"
                    size="sm"
                    disabled={quizIndex === article.quiz.length - 1}
                    onClick={() => selectQuiz(article.quiz[quizIndex + 1].id)}
                  >
                    다음 문항 →
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-[14px] text-grey-500">문항이 없어요. ‘+ 문항 추가’를 눌러 만들어 주세요.</p>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card id="edit-vocab" className={ANCHOR}>
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

          <Card id="edit-keypoints" className={ANCHOR}>
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

          <Card id="edit-opinion" className={ANCHOR}>
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

          <SourcesCard sources={article.sources} />
        </div>
      </div>
    </div>
  );
}

/* 참고한 기사: 출처가 스무 곳이 넘을 수 있어 처음엔 접어 두고, 펼치면 최신순으로 '제목 / 언론사 · 날짜' 두 줄씩 보여 준다 */

// 검색 결과 제목 끝에 붙는 "| 연합뉴스", "- 매일경제", "< 국제 < 기사본문 - 포토뉴스" 같은 꼬리를 떼고 언론사 이름을 꺼낸다
function splitSourceTitle(raw: string, url: string): { title: string; outlet: string } {
  let title = raw.trim();
  let outlet = "";
  const dash = title.match(/\s+-\s+([^-|<]{1,20})$/);
  const crumb = title.indexOf(" < ");
  if (crumb > 0) {
    if (dash) outlet = dash[1].trim();
    title = title.slice(0, crumb);
  } else {
    const bar = title.match(/\s+\|\s+([^|]+)$/);
    const tail = bar ?? dash;
    if (tail && tail.index && tail.index > 0) {
      outlet = tail[1].trim();
      title = title.slice(0, tail.index);
    }
  }
  if (!outlet) {
    try {
      outlet = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      outlet = "";
    }
  }
  return { title: title.trim() || raw, outlet };
}

function SourcesCard({ sources }: { sources: SourceItem[] }) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => {
    const time = (s: SourceItem) => Date.parse(s.pubDate) || 0;
    return [...sources].sort((a, b) => time(b) - time(a));
  }, [sources]);
  if (sources.length === 0) return null;

  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h3 className="text-[17px] font-bold text-grey-900">
          참고한 기사 <span className="text-grey-500">{sources.length}곳</span>
        </h3>
        <span className="flex items-center gap-1 text-[13px] text-grey-500">
          {open ? "접기" : "펼치기"}
          <ChevronRight className={cn("size-4 transition-transform", open ? "-rotate-90" : "rotate-90")} />
        </span>
      </button>
      {open && (
        <ul className="mt-4 divide-y divide-grey-100">
          {sorted.map((s, i) => {
            const { title, outlet } = splitSourceTitle(s.title, s.url);
            return (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noreferrer" title={s.title} className="group block py-2.5">
                  <span className="line-clamp-1 text-[14px] font-medium text-grey-700 group-hover:underline">{title}</span>
                  <span className="mt-0.5 flex gap-1.5 text-[12px] text-grey-400">
                    {outlet && <span className="truncate">{outlet}</span>}
                    {outlet && <span aria-hidden>·</span>}
                    <span className="shrink-0">{formatDateTime(s.pubDate)}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* 상단 이동 바: 화면 위에 붙어 있고, 누르면 그 부분으로 바로 스크롤한다 (퀴즈 버튼은 그 문항을 골라 보여 준다) */

// 상단 헤더(64px) + 이동 바 높이만큼 띄워서 제목이 가려지지 않게 한다
const ANCHOR = "scroll-mt-36";

const QUIZ_ANCHOR_PREFIX = "edit-quiz-";
const quizAnchor = (id: string) => `${QUIZ_ANCHOR_PREFIX}${id}`;

function isQuizIncomplete(q: QuizItem) {
  if (!q.prompt.trim() || q.choices.some((c) => !c.trim())) return true;
  if (q.type !== "comprehension" && !q.sentence.trim()) return true;
  return q.type === "synonym" && !q.target.trim();
}

function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

interface NavItem {
  id: string;
  label: string;
  incomplete?: boolean;
  quiz?: boolean;
}

function JumpBar({
  items,
  selectedQuiz,
  onSelectQuiz,
  onAddQuiz,
}: {
  items: NavItem[];
  selectedQuiz?: string;
  onSelectQuiz: (id: string) => void;
  onAddQuiz: () => void;
}) {
  const [current, setCurrent] = useState(items[0]?.id);
  const barRef = useRef<HTMLDivElement>(null);
  const ids = items.map((item) => item.id).join(",");

  // 버튼으로 이동하는 동안에는 스크롤 위치 대신 누른 버튼을 표시한다
  const lockedUntil = useRef(0);

  // 스크롤 위치에 맞춰 지금 보고 있는 부분을 표시한다 (화면에는 고른 문항 하나만 있으니 문항이 바뀔 때도 다시 계산한다)
  useEffect(() => {
    const all = ids.split(",");
    // 넓은 화면에서는 오른쪽 열(어휘 등)이 본문·퀴즈 옆에 나란히 있어 위치로 구분할 수 없으니 왼쪽 열만 따라간다
    const leftColumn = all.filter((id) => id === "edit-body" || id.startsWith(QUIZ_ANCHOR_PREFIX));
    const wide = window.matchMedia("(min-width: 1024px)");
    function update() {
      if (Date.now() < lockedUntil.current) return;
      const list = wide.matches ? leftColumn : all;
      // 맨 아래까지 내려서 마지막 부분이 위쪽 기준선에 닿지 못하면, 화면에 보이는 마지막 부분을 고른다
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const line = atBottom ? window.innerHeight : 160;
      let found = list[0];
      let best = -Infinity;
      for (const id of list) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line && top > best) {
          best = top;
          found = id;
        }
      }
      setCurrent(found);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ids, selectedQuiz]);

  // 이동 바가 가로로 넘칠 때 현재 버튼이 보이도록 바만 가로 스크롤한다
  useEffect(() => {
    const bar = barRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-nav="${current}"]`);
    if (!bar || !chip) return;
    const left = chip.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft || left + chip.offsetWidth > bar.scrollLeft + bar.clientWidth) {
      bar.scrollTo({ left: left - 16, behavior: "smooth" });
    }
  }, [current]);

  const incomplete = items.filter((item) => item.incomplete).length;

  return (
    <div className="sticky top-16 z-30 -mx-1 rounded-2xl bg-grey-50/95 px-1 py-2 backdrop-blur">
      <div ref={barRef} className="flex items-center gap-1.5 overflow-x-auto">
        {items.map((item, i) => (
          <Fragment key={item.id}>
            {(item.quiz && !items[i - 1]?.quiz) || (!item.quiz && items[i - 1]?.quiz) ? (
              <span className="mx-1 h-5 w-px shrink-0 bg-grey-200" />
            ) : null}
            <button
              type="button"
              data-nav={item.id}
              onClick={() => {
                lockedUntil.current = Date.now() + 1000;
                setCurrent(item.id);
                if (item.quiz) onSelectQuiz(item.id);
                else jumpTo(item.id);
              }}
              title={item.incomplete ? "비어 있는 칸이 있어요" : undefined}
              className={cn(
                "relative h-9 shrink-0 rounded-xl px-3 text-[14px] font-semibold transition",
                current === item.id ? "bg-grey-900 text-white" : "bg-white text-grey-600 hover:bg-grey-100",
              )}
            >
              {item.label}
              {item.incomplete && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-danger" />}
            </button>
            {item.quiz && !items[i + 1]?.quiz && (
              <button
                type="button"
                onClick={onAddQuiz}
                className="h-9 shrink-0 rounded-xl px-2.5 text-[14px] font-semibold text-grey-500 hover:bg-grey-100"
                aria-label="문항 추가"
                title="문항 추가"
              >
                +
              </button>
            )}
          </Fragment>
        ))}
        {incomplete > 0 && (
          <span className="ml-auto shrink-0 pl-3 pr-2 text-[13px] text-grey-500">
            <span className="mr-1 inline-block size-1.5 rounded-full bg-danger align-middle" />
            빈칸 있는 문항 {incomplete}개
          </span>
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
    <div id={quizAnchor(item.id)} className={cn("rounded-2xl border border-grey-200 p-4", ANCHOR)}>
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

  if (worksheet.status === "draft" && submissions.length === 0) {
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
                {s.feedback.keyword ? (
                  <p>
                    키워드 요약 · 문단 키워드 {s.feedback.keyword.paragraphs[0]}/{s.feedback.keyword.paragraphs[1]} · 전체 요약 빈칸{" "}
                    {s.feedback.keyword.summary[0]}/{s.feedback.keyword.summary[1]} (처음·두 번째에 맞힌 빈칸)
                  </p>
                ) : (
                  <p>
                    핵심 내용 {s.feedback.breakdown.content}/50 · 텍스트 재구성 {s.feedback.breakdown.ownWords}/30 · 문장 완성도{" "}
                    {s.feedback.breakdown.sentence}/20
                  </p>
                )}
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
