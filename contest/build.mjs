/*
 * 공모전 체험판 빌드: 실제 앱(src)의 페이지·컴포넌트·API 코드와 Tailwind 디자인을 HTML 파일 하나로 묶는다.
 *   node contest/build.mjs [출력 파일]      (기본: contest/dist/readingpractice-contest.html)
 *   CONTEST_SITE=https://... 로 AI를 부를 실제 서버 주소를 바꿀 수 있다.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.resolve(process.argv[2] ?? path.join(here, "dist", "readingpractice-contest.html"));
const site = process.env.CONTEST_SITE || "https://readingpractice.vercel.app";

const src = (p) => path.join(root, "src", p);
const own = (p) => path.join(here, p);

/** 실제 앱 파일 → 체험판 파일 (브라우저에서 돌 수 없거나, AI를 실제 서버로 보내야 하는 곳) */
const OVERRIDES = new Map([
  [src("lib/env.ts"), own("overrides/env.ts")],
  [src("lib/claude.ts"), own("overrides/claude.ts")],
  [src("lib/db/index.ts"), own("overrides/db-index.ts")],
  [src("lib/mailer.ts"), own("overrides/mailer.ts")],
  [src("lib/feedback.ts"), own("overrides/feedback.ts")],
  [src("lib/report-ai.ts"), own("overrides/report-ai.ts")],
  [src("lib/demo-account.ts"), own("overrides/demo-account.ts")],
  [src("components/ModeNotice.tsx"), own("overrides/ModeNotice.tsx")],
  [src("app/teacher/beta/page.tsx"), own("overrides/beta-page.tsx")],
  [src("app/teacher/login/page.tsx"), own("overrides/login-page.tsx")],
  [src("app/api/worksheets/[worksheetId]/articles/route.ts"), own("overrides/articles-route.ts")],
  [src("app/api/worksheets/[worksheetId]/articles/[articleId]/regenerate/route.ts"), own("overrides/regenerate-route.ts")],
]);

/** Next.js·Node 전용 모듈 → 브라우저용 대체 */
const SHIMS = {
  "next/link": own("shims/next-link.tsx"),
  "next/navigation": own("shims/next-navigation.ts"),
  "next/headers": own("shims/next-headers.ts"),
  "next/server": own("shims/next-server.ts"),
  fs: own("shims/fs.ts"),
  path: own("shims/path.ts"),
  crypto: own("shims/crypto.ts"),
  jose: own("shims/jose.ts"),
  "@anthropic-ai/sdk": own("shims/anthropic.ts"),
  "@anthropic-ai/sdk/helpers/zod": own("shims/anthropic.ts"),
};
const EMPTY = /^(node:.*|nodemailer|@supabase\/supabase-js)$/;

const contestPlugin = {
  name: "contest",
  setup(build) {
    build.onResolve({ filter: /.*/ }, async (args) => {
      if (args.pluginData?.inner) return undefined;
      if (SHIMS[args.path]) return { path: SHIMS[args.path] };
      if (EMPTY.test(args.path)) return { path: own("shims/empty.ts") };
      // overrides가 원래 파일을 부를 때: import ... from "orig:@/lib/feedback"
      const original = args.path.startsWith("orig:");
      if (!original && args.importer.includes("node_modules")) return undefined;
      const resolved = await build.resolve(original ? args.path.slice(5) : args.path, {
        kind: args.kind,
        importer: args.importer,
        resolveDir: args.resolveDir,
        pluginData: { inner: true },
      });
      if (resolved.errors.length) return { errors: resolved.errors };
      if (!original && OVERRIDES.has(resolved.path)) return { path: OVERRIDES.get(resolved.path) };
      return { path: resolved.path, sideEffects: resolved.sideEffects };
    });
  },
};

const js = await esbuild.build({
  entryPoints: [own("app/main.tsx")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["chrome100", "safari16", "firefox110"],
  jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"),
  legalComments: "none",
  logLevel: "warning",
  logOverride: { "unsupported-directive": "silent" },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.CONTEST_SITE": JSON.stringify(site),
  },
  // 서버 코드가 모듈을 읽자마자 process.env·process.cwd()를 쓰므로 가장 먼저 만들어 둔다
  banner: { js: 'globalThis.process={env:{SESSION_SECRET:"contest-demo"},cwd:function(){return "/"}};' },
  plugins: [contestPlugin],
});

const cssInput = await readFile(src("app/globals.css"), "utf8");
const css = await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(cssInput, {
  from: src("app/globals.css"),
});

const script = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#ffffff">
<title>시사 문해력 기르기 학습지</title>
<meta name="description" content="이번 주 뉴스로 어휘력과 문해력을 기르는 학습지 (공모전 체험판)">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>${css.css}</style>
</head>
<body class="min-h-dvh antialiased">
<div id="root"></div>
<script>${script}</script>
</body>
</html>
`;
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, html);
console.log(`${path.relative(process.cwd(), out)} (${(html.length / 1024).toFixed(0)} KB, AI 서버 ${site})`);
