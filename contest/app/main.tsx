import { Component, Suspense, use, useEffect, useState, useTransition, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { getDb } from "@/lib/db";
import { GRADE_LIST } from "@/lib/grades";
import { nowIso, weekKey } from "@/lib/utils";
import { ensureDemoTeacher } from "../overrides/demo-account";
import { NextRequest } from "../shims/next-server";
import { NotFoundSignal, RedirectSignal } from "../shims/next-navigation";
import { currentLocation, navigate, subscribe, type Location } from "../shims/router";
import { remoteWeekly } from "./contest-api";
import { ContestBar } from "./ContestBar";
import { API, matchPath, NOT_FOUND, PAGES } from "./routes";
import { SITE } from "./site";

/*
 * 공모전 체험판: 실제 앱(src/app)의 페이지·API를 브라우저 안에서 그대로 돌린다.
 * - 페이지(서버 컴포넌트)는 async 함수라서 결과를 use()로 기다려 그린다.
 * - fetch("/api/...")는 실제 API route 코드로 바로 보낸다 (저장은 이 브라우저의 localStorage).
 * - AI가 필요한 일만 overrides가 실제 서버의 공모전 API로 보낸다.
 */

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("/api/")) return realFetch(input, init);
  const u = new URL(url, "http://contest.local");
  const m = matchPath(API, u.pathname);
  const method = (init?.method ?? "GET").toUpperCase();
  const handler = m?.value[method] as ((req: NextRequest, ctx: unknown) => Promise<Response>) | undefined;
  if (!m || typeof handler !== "function") return Response.json({ error: "체험판에서 쓸 수 없는 기능이에요." }, { status: 404 });
  const req = new NextRequest(u.href, { method, headers: init?.headers, body: method === "GET" ? undefined : init?.body });
  return handler(req, { params: Promise.resolve(m.params) });
};

/* 앱 안 주소를 가리키는 일반 <a href="/...">: 앱 안이면 이동하고, 파일(안내서·양식)이면 실제 사이트에서 연다 */
document.addEventListener("click", (e) => {
  const a = (e.target as Element | null)?.closest?.("a");
  const href = a?.getAttribute("href");
  if (!a || !href?.startsWith("/") || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  if (matchPath(PAGES, href.split("?")[0])) navigate(href);
  else window.open(SITE + href, "_blank", "noopener");
});

interface Rendered {
  node?: ReactNode;
  redirect?: string;
}

async function renderPage(loc: Location): Promise<Rendered> {
  const m = matchPath(PAGES, loc.pathname);
  const page = m?.value ?? NOT_FOUND;
  try {
    const node = (await page({
      params: Promise.resolve(m?.params ?? {}),
      searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(loc.search))),
    })) as ReactNode;
    return { node };
  } catch (error) {
    if (error instanceof RedirectSignal) return { redirect: error.href };
    if (error instanceof NotFoundSignal) return { node: (await NOT_FOUND({})) as ReactNode };
    return { node: <Crash error={error} /> };
  }
}

function Crash({ error }: { error: unknown }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
      <p className="text-[40px]">⚠️</p>
      <p className="mt-2 text-[17px] font-bold">화면을 그리지 못했어요</p>
      <p className="mt-1 text-[14px] text-grey-500">{error instanceof Error ? error.message : String(error)}</p>
      <a href="#/" className="mt-6 font-semibold text-primary">
        처음으로
      </a>
    </main>
  );
}

class Boundary extends Component<{ children: ReactNode; resetKey: unknown }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    return this.state.error ? <Crash error={this.state.error} /> : this.props.children;
  }
}

function PageView({ promise }: { promise: Promise<Rendered> }) {
  const r = use(promise);
  useEffect(() => {
    if (r.redirect) navigate(r.redirect, true);
  }, [r]);
  return r.redirect ? null : r.node;
}

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="size-8 animate-spin rounded-full border-[3px] border-primary border-r-transparent" />
    </div>
  );
}

function App() {
  const [promise, setPromise] = useState(() => renderPage(currentLocation()));
  const [, startTransition] = useTransition();
  useEffect(
    () =>
      subscribe(() => {
        const next = renderPage(currentLocation());
        startTransition(() => setPromise(next));
      }),
    [],
  );
  return (
    <>
      <Boundary resetKey={promise}>
        <Suspense fallback={<Loading />}>
          <PageView promise={promise} />
        </Suspense>
      </Boundary>
      <ContestBar />
    </>
  );
}

/** 실제 서버가 이번 주에 만든 학년군별 기사를 받아 둔다 (선생님의 '이번 주 기사 불러오기'가 이것을 복사한다) */
async function preloadWeekly() {
  const db = getDb();
  const week = weekKey();
  await Promise.all(
    GRADE_LIST.map(async ({ level }) => {
      if ((await db.getWeeklySet(week, level))?.articles.length) return;
      const articles = await remoteWeekly(level).catch(() => []);
      if (articles.length) await db.saveWeeklySet({ week, gradeLevel: level, articles, createdAt: nowIso(), updatedAt: nowIso() });
    }),
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<Loading />);
void Promise.all([preloadWeekly(), ensureDemoTeacher()])
  .catch((error) => console.error("[contest] 준비 실패", error))
  .finally(() => root.render(<App />));
