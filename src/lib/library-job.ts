import { z } from "zod";
import { fetchArticle } from "./article-fetch";
import { generateJson } from "./claude";
import { getDb } from "./db";
import { checkReadability, ECONOMY_KEYWORD_LIST, ECONOMY_STRUCTURE } from "./economy-guide";
import { isDemoGeneration } from "./env";
import { buildArticle } from "./generation";
import { type CurriculumStandard, describeStandard, standardsForField } from "./curriculum-standards";
import { GRADE_LIST, GRADES } from "./grades";
import { hasKogl1Mark, sourceOf } from "./library-sources";
import { FIELD_ORDER, LIBRARY_FIELDS, listLibraryArticles } from "./library";
import { findOverlap } from "./text-overlap";
import type { GradeLevel, LibraryArticle, LibraryField, LibraryJobRun, LibraryLicense } from "./types";
import { newId, nowIso, weekStartIso } from "./utils";

/**
 * 관심 분야 학습 자동 추가: 매주 분야마다 학년군(초3~4·초5~6·중학교)별 기사 1편씩.
 * 매일 Cron(06:00 KST)에서 부르고, 한 번에 분야마다 아직 없는 학년군 기사를 낮은 학년군부터 1편만 만든다(실행 시간 제한).
 * 이번 주 기사 준비로 바쁜 월요일은 쉬고 화요일부터 만든다. 그 학년군에 맞는 원문이 없으면 다음 날 새 원문으로 다시 찾는다.
 * 경제 기사는 초등 경제 참고 자료의 개념 낱말과 글 짜임(economy-guide.ts)으로 쓰고, 학년군 문해력 기준(분량·문단·문장 길이)을 재어
 * 맞지 않으면 한 번 고쳐 쓰고, 그래도 맞지 않으면 쓰지 않는다.
 * 내용만 참고해야 하는 원문(reference: 한국은행·경제배움e+)은 새로 쓴 글에 원문과 똑같이 이어지는 구절이 있는지도 재어 같은 방식으로 고친다.
 * 초3~4는 성취기준이 적어(경제 2개) 초5~6 성취기준과 맞는 원문도 초3~4 수준으로 쉽게 풀어 쓸 수 있으면 쓴다.
 * Cron 실행 시간 제한(maxDuration 300초)에 끊겨 아무것도 저장하지 못하는 일이 없도록 정해 둔 시간 안에서만 새 원문을 보고,
 * 학년군에 맞지 않아 버린 원문은 실행 기록(library_job_runs)에 남겨 다음 날 그 학년군에서 다시 보지 않는다.
 */

interface Feed {
  url: string;
  site: string;
  /** public-domain: 미국 정부 기관 공공 저작물, kogl: 공공누리 제1유형, reference: 내용만 참고해 새로 쓴다 */
  license: LibraryLicense;
  /** 여러 기관 자료를 모은 피드에서 이 기관이 올린 글만 쓴다 (RSS author) */
  publishers?: string[];
  /** 원문 페이지 대신 RSS 설명과 기관 소개 글을 본문으로 쓴다 (본문이 영상·파일이라 페이지에서 글을 뽑을 수 없는 곳) */
  textFromFeed?: boolean;
  /** RSS가 없는 곳: 미리 골라 둔 항목을 차례로 쓴다 (학년군이 정해진 항목은 그 학년군에서만 쓴다) */
  entries?: { title: string; url: string; grade: GradeLevel }[];
}

/** 한국민족문화대백과사전 항목. 교육과정 성취기준(초3~4 옛날 풍습·교통·통신·문화유산, 초5~6 선사~근대, 중학교 한국사)에 맞춰 골랐다 */
const encyEntries = (grade: GradeLevel, list: [title: string, eid: string][]) =>
  list.map(([title, eid]) => ({ title, url: `https://encykorea.aks.ac.kr/Article/${eid}`, grade }));

const ENCY_ENTRIES = [
  ...encyEntries("elem34", [
    ["윷놀이", "E0042794"],
    ["연날리기", "E0036725"],
    ["강강술래", "E0000958"],
    ["한복", "E0061645"],
    ["온돌문화", "E0077489"],
    ["초가", "E0056932"],
    ["짚신", "E0055101"],
    ["장승", "E0048619"],
    ["서당", "E0027680"],
    ["파발", "E0059563"],
  ]),
  ...encyEntries("elem56", [
    ["고조선", "E0003937"],
    ["비파형 동검", "E0025256"],
    ["청자", "E0056611"],
    ["백운화상초록불조직지심체요절", "E0022266"],
    ["한글", "E0061508"],
    ["측우기", "E0058337"],
    ["앙부일구", "E0035191"],
    ["거북선", "E0001833"],
    ["서원", "E0028091"],
    ["3·1운동", "E0026772"],
  ]),
  ...encyEntries("middle", [
    ["고분벽화", "E0003619"],
    ["경주 석굴암 석굴", "E0028362"],
    ["발해", "E0021626"],
    ["금속활자", "E0007871"],
    ["대동법", "E0014246"],
    ["실학", "E0033695"],
    ["동의보감", "E0016731"],
    ["수원 화성", "E0064671"],
    ["독립협회", "E0015993"],
    ["한국광복군", "E0005134"],
  ]),
];

/** 경제배움e+에서 쓸 정부 기관 (민간 언론사·연구원·협회 자료는 쓰지 않는다) */
const ECONEDU_GOV = [
  "재정경제부",
  "기획재정부",
  "국세청",
  "관세청",
  "공정거래위원회",
  "금융위원회",
  "국토교통부",
  "고용노동부",
  "산업통상부",
  "중소벤처기업부",
  "통계청",
  "국가데이터처",
  "대한민국 정부",
];

/** 원문 출처 허용 목록(library-sources.ts)에 있는 곳의 피드. 원문 주소도 다시 한 번 허용 목록으로 거른다 */
const FEEDS: Record<LibraryField, Feed[]> = {
  space: [
    { url: "https://science.nasa.gov/feed/", site: "NASA Science", license: "public-domain" },
    { url: "https://www.nasa.gov/feed/", site: "NASA", license: "public-domain" },
  ],
  earth: [
    { url: "https://www.noaa.gov/rss.xml", site: "NOAA", license: "public-domain" },
    { url: "https://www.usgs.gov/news/all-news/feed", site: "USGS", license: "public-domain" },
  ],
  economy: [
    {
      url: "https://www.econedu.go.kr/user/siteInfo/rssGuid/findEcon/feed",
      site: "경제배움e+",
      license: "reference",
      publishers: ECONEDU_GOV,
      textFromFeed: true,
    },
  ],
  culture: [{ url: "https://encykorea.aks.ac.kr/", site: "한국민족문화대백과사전", license: "kogl", entries: ENCY_ENTRIES }],
};

const ANALYZE_MODEL = "claude-haiku-4-5-20251001";
const MAX_CANDIDATES = 4;
const FEED_TIMEOUT_MS = 20000;
/** 큰 피드(경제배움e+는 수천 건)에서 앞쪽 최신 글만 본다 */
const MAX_FEED_ITEMS = 60;
/** 이 시간이 지나면 새 원문을 보지 않는다 (Cron 300초 안에 저장·기록까지 마치도록) */
const TIME_BUDGET_MS = 240_000;
/** 기사 한 편을 쓰고 고쳐 쓰는 데 드는 시간의 넉넉한 어림 */
const BUILD_RESERVE_MS = 90_000;
/** 버린 원문을 다시 보지 않는 기간 */
const REJECT_MEMORY_DAYS = 30;

interface FeedItem {
  title: string;
  url: string;
  feed: Feed;
  /** textFromFeed 피드의 RSS 설명 */
  description?: string;
  /** 이 학년군에서만 쓸 항목 */
  grade?: GradeLevel;
}

const decode = (text: string) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&middot;/g, "·")
    .replace(/&#0?39;|&#8217;/g, "'")
    .trim();

const stripTags = (html: string) => decode(decode(html)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (readingpractice education bot)" },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

async function readFeed(feed: Feed): Promise<FeedItem[]> {
  if (feed.entries) return feed.entries.map((e) => ({ title: e.title, url: e.url, feed, grade: e.grade }));
  const body = await fetchText(feed.url).catch((e) => {
    throw new Error(`${feed.site} 목록: ${e instanceof Error ? e.message : "가져오기 실패"}`);
  });
  const items: FeedItem[] = [];
  for (const [, item] of body.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    if (items.length >= MAX_FEED_ITEMS) break;
    const title = decode(decode(item.match(/<title\b[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? ""));
    const url = decode(item.match(/<link\b[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const author = decode(item.match(/<(?:author|dc:creator)\b[^>]*>([\s\S]*?)<\/(?:author|dc:creator)>/)?.[1] ?? "");
    if (feed.publishers && !feed.publishers.includes(author)) continue;
    const description = feed.textFromFeed ? stripTags(item.match(/<description\b[^>]*>([\s\S]*?)<\/description>/)?.[1] ?? "") : undefined;
    if (title && /^https?:\/\//.test(url)) items.push({ title, url, feed, description });
  }
  return items.slice(0, MAX_FEED_ITEMS);
}

/** 한국민족문화대백과사전 항목 본문: 집필자 안내 문구 다음부터 참고문헌 앞까지 (사진 설명·메뉴는 뺀다) */
function encyText(html: string) {
  const lines = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((l) => decode(l.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))).replace(/\s+/g, " ").trim());
  const start = lines.findIndex((l) => l.startsWith("본 항목의 내용은"));
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("- ") || line.startsWith("본 항목의 내용은") || line === "참고문헌" || line === "관련 미디어") break;
    if (line.length > 1 && !["닫기", "음성 재생", "있습니다."].includes(line)) body.push(line);
  }
  return start < 0 ? "" : body.join("\n");
}

/** 원문 글. 공공누리 제1유형 표시가 있어야 하는 곳은 페이지에서 표시를 확인한다 */
async function readSource(item: FeedItem): Promise<string> {
  const source = sourceOf(item.url);
  if (!source) throw new Error("허용 목록에 없는 출처");
  if (source.kogl1Only) {
    if (!hasKogl1Mark(await fetchText(item.url))) throw new Error("공공누리 제1유형 표시 없음");
  }
  if (new URL(item.url).hostname === "encykorea.aks.ac.kr") return encyText(await fetchText(item.url));
  if (item.feed.textFromFeed) {
    // 경제배움e+ 글은 RSS 설명이 곧 기관이 쓴 소개 글이다
    return `${item.title}\n\n${item.description ?? ""}`;
  }
  return (await fetchArticle(item.url)).text;
}

const AnalysisSchema = z.object({
  suitable: z.boolean(),
  reason: z.string(),
  keyword: z.string(),
  title: z.string(),
  standards: z.array(z.string()),
  summary: z.string(),
  facts: z.array(z.string()),
});

const SYSTEM =
  "너는 대한민국 초등학생·중학생을 위한 교육 콘텐츠 편집자이자 저작권 검토자다. 우리나라 교육과정을 잘 알고, 사실에 충실하며, 정치적으로 중립적이다.";

async function analyze(field: LibraryField, grade: GradeLevel, item: FeedItem, text: string, standards: CurriculumStandard[]) {
  const line = (s: CurriculumStandard) => `${describeStandard(s)} ${s.text}`;
  const own = standards.filter((s) => s.grade === grade);
  const upper = standards.filter((s) => s.grade !== grade);
  const list = [
    ...own.map(line),
    ...(upper.length
      ? [
          `\n[${GRADES[grade].label}과 맞는 글이 아니면 — 바로 위 학년군 성취기준. 이 내용을 ${GRADES[grade].label} 학생이 쉬운 말로 이해할 수 있을 때만 고른다]`,
          ...upper.map(line),
        ]
      : []),
  ].join("\n");
  return generateJson(AnalysisSchema, {
    model: ANALYZE_MODEL,
    system: SYSTEM,
    prompt: `[분야] ${LIBRARY_FIELDS[field].label}
[출처] ${item.feed.site} — ${item.title}
[주소] ${item.url}

[원문]
${text}

위 원문으로 ${GRADES[grade].label} 학생이 상시로 읽을 '${LIBRARY_FIELDS[field].label}' 분야 읽기 자료를 만들 수 있는지 판단하라.

suitable을 false로 하는 경우
- 원문에 기관이 아닌 외부 작가·사진가·언론사의 저작권 표시가 있거나, 다른 매체 글을 옮겨 실은 글(© 표시, "Reprinted with permission", "Guest post", "Courtesy of" 등). 사이트 맨 아래의 일반적인 저작권 문구는 해당하지 않는다.
- 인사 발령, 행사 안내, 입찰, 조직 소식, 보도 일정처럼 학생이 배울 내용이 거의 없는 글
- 정치적 논쟁, 특정 정당·정치인 평가, 폭력·재난 피해 묘사가 중심인 글
- 아래 ${GRADES[grade].label} 성취기준 어느 것과도 내용이 실제로 이어지지 않는 글 (다른 학년군 내용을 억지로 맞추지 않는다)
- ${GRADES[grade].label} 학생이 쉬운 말로 풀어 써도 이해하기 어려울 만큼 개념이 어려운 글
reason에는 판단 까닭을 한 문장으로 쓴다.

[2022 개정 교육과정 ${GRADES[grade].label} 성취기준 — 이 분야와 관련 있는 것]
${list}

suitable이 true이면
- standards: 위 성취기준 목록에서 이 글의 내용을 실제로 배우는 성취기준의 코드를 1~3개 고른다. 예) ["[6과12-03]"]. 목록에 없는 코드를 지어내지 않는다.
- 목록에 이 글과 맞는 성취기준이 없으면 suitable을 false로 한다.
- keyword: 학생이 상자에서 보고 누를 짧은 한국어 키워드(2~8자). 예) "화성", "엘니뇨", "기준금리"${
      field === "economy"
        ? `\n  경제 분야는 글의 중심 개념이 다음 경제 개념 낱말 가운데 하나와 맞으면 그 낱말을 keyword로 쓴다: ${ECONOMY_KEYWORD_LIST.join(", ")}`
        : ""
    }
- title: 학생용 한국어 제목(25자 이내)
- summary: 무엇에 관한 글인지 한 문장
- facts: 원문에서 확인되는 사실 6~12개를 한국어 한 문장씩. 원문에 없는 숫자·이름·날짜를 지어내지 않는다.
suitable이 false이면 나머지 칸은 빈 값으로 둔다.`,
  });
}

/** 원문 본문. 가져오지 못했거나 너무 짧으면 까닭(문자열)을 돌려준다 */
async function sourceText(item: FeedItem): Promise<{ text: string } | { reason: string }> {
  try {
    const text = await readSource(item);
    if (text.length < (item.feed.textFromFeed ? 250 : 600)) return { reason: "본문이 짧음" };
    return { text };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : "가져오기 실패" };
  }
}

/** 원문 후보 중에서 이 학년군 성취기준과 맞는 글을 찾아 그 학년군 수준으로 기사를 쓴다. 기사로 쓴 원문은 usedUrls에 넣는다 */
async function buildFor(
  field: LibraryField,
  grade: GradeLevel,
  items: FeedItem[],
  usedUrls: Set<string>,
  texts: Map<string, Promise<{ text: string } | { reason: string }>>,
  rejected: Set<string>,
  deadline: number,
): Promise<LibraryArticle | { skipped: string; rejected: string[] }> {
  const candidates = items
    .filter((item) => (!item.grade || item.grade === grade) && !usedUrls.has(item.url) && !rejected.has(`${grade} ${item.url}`))
    .slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return { skipped: "새 원문 없음", rejected: [] };

  // 초3~4는 성취기준이 적어 초5~6 성취기준과 맞는 원문도 쉽게 풀어 쓴다
  const gradesToMatch: GradeLevel[] = grade === "elem34" ? ["elem34", "elem56"] : [grade];
  const standards = standardsForField(field).filter((s) => gradesToMatch.includes(s.grade));
  const reasons: string[] = [];
  /** 이 학년군에 맞지 않아 버린 원문 (가져오기 실패·시간 부족은 넣지 않는다) */
  const newlyRejected: string[] = [];
  const reject = (item: FeedItem, reason: string) => {
    reasons.push(`${item.title}: ${reason}`);
    newlyRejected.push(item.url);
  };
  for (const item of candidates) {
    if (Date.now() > deadline - BUILD_RESERVE_MS) {
      reasons.push("시간이 모자라 다음 실행에서 이어서 찾음");
      break;
    }
    // 같은 원문을 다른 학년군에서 다시 볼 때 페이지를 또 받지 않는다
    if (!texts.has(item.url)) texts.set(item.url, sourceText(item));
    const source = await texts.get(item.url)!;
    if ("reason" in source) {
      reasons.push(`${item.title}: ${source.reason}`);
      continue;
    }
    const analysis = await analyze(field, grade, item, source.text, standards);
    // 목록(이 학년군 성취기준)에 없는 코드는 버린다
    const picked = standards.filter((s) => analysis.standards.includes(s.code));
    if (!analysis.suitable || picked.length === 0 || analysis.facts.length < 4) {
      reject(item, analysis.suitable && picked.length === 0 ? "목록에 있는 성취기준과 맞지 않음" : analysis.reason || "학습 자료로 알맞지 않음");
      continue;
    }
    const sources = [{ title: `${item.feed.site} — ${item.title}`, url: item.url, description: "", pubDate: "" }];
    const topic = { name: analysis.keyword, summary: analysis.summary, facts: analysis.facts, sources };
    const structure = field === "economy" ? ECONOMY_STRUCTURE : undefined;
    /** 경제 기사는 학년군 문해력 기준, 내용만 참고할 원문은 원문 구절을 옮겼는지 잰다 */
    const problemsOf = (b: Awaited<ReturnType<typeof buildArticle>>) => [
      ...(field === "economy" ? checkReadability(b.paragraphs, grade).problems : []),
      ...(item.feed.license === "reference"
        ? findOverlap([...b.paragraphs, b.modelSummary, ...b.keyPoints], source.text).copied.map(
            (c) => `원문과 똑같이 이어지는 구절이 있어요(${c}). 원문의 문장을 옮기지 말고 새 문장으로 써라`,
          )
        : []),
    ];
    let built = await buildArticle(topic, grade, false, structure);
    let problems = problemsOf(built);
    if (problems.length && Date.now() > deadline) {
      reasons.push(`${item.title}: 기준에 맞지 않았는데 고쳐 쓸 시간이 모자람`);
      break;
    }
    if (problems.length) {
      // 고칠 점을 알려 주고 한 번만 다시 쓴다. 그래도 맞지 않으면 이 원문은 쓰지 않는다
      built = await buildArticle(topic, grade, false, structure, problems.map((p) => `- ${p}`).join("\n"));
      problems = problemsOf(built);
    }
    if (problems.length) {
      reject(item, `기준에 맞지 않음 (${problems.join(", ")})`);
      continue;
    }
    usedUrls.add(item.url);
    return {
      id: `lib-auto-${newId()}`,
      topic: analysis.keyword,
      topicSummary: analysis.summary,
      facts: analysis.facts,
      mentionCount: 1,
      status: "ready",
      ...built,
      sourceMode: "url",
      sources,
      // 관심 분야 학습은 혼자 읽는 학습이라 생각 나누기를 두지 않는다
      opinionQuestion: "",
      stances: [],
      field,
      keyword: analysis.keyword,
      gradeLevels: [grade],
      curriculum: picked.map(describeStandard).join(", "),
      origin: { site: item.feed.site, title: item.title, url: item.url, license: item.feed.license },
      addedBy: "auto",
      createdAt: nowIso(),
    };
  }
  return { skipped: reasons.join(" / ") || "알맞은 원문 없음", rejected: newlyRejected };
}

export async function runLibraryJob(now = new Date()) {
  if (isDemoGeneration()) return { skipped: "AI·검색 키가 없어 자동 추가를 하지 않아요" };
  const seoulDay = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCDay();
  if (seoulDay === 1) return { skipped: "월요일은 이번 주 기사 준비로 쉬어요" };

  const deadline = Date.now() + TIME_BUDGET_MS;
  const weekStart = weekStartIso(now);
  const db = getDb();
  const since = new Date(now.getTime() - REJECT_MEMORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [articles, runs] = await Promise.all([listLibraryArticles(), db.listLibraryJobRuns(since).catch((e) => {
      // 기록을 읽지 못해도 기사는 만든다
      console.error("library_job_runs 읽기 실패", e);
      return [];
    }),
  ]);
  const rejected = new Set(runs.flatMap((r) => r.rejected.map((x) => `${x.grade} ${x.url}`)));
  const newlyRejected: LibraryJobRun["rejected"] = [];
  const usedUrls = new Set(articles.map((a) => a.origin.url));
  /** 분야마다 이번 주 자동 기사가 아직 없는 학년군 (낮은 학년군부터) */
  const missing = (field: LibraryField) =>
    GRADE_LIST.map((g) => g.level).filter(
      (grade) =>
        !articles.some((a) => a.field === field && a.addedBy === "auto" && a.createdAt >= weekStart && a.gradeLevels.includes(grade)),
    );
  const todo = FIELD_ORDER.filter((field) => missing(field).length > 0);
  if (todo.length === 0) return { skipped: "이번 주 분야·학년군별 기사가 모두 있어요" };

  // 분야끼리는 함께, 한 분야 안에서는 학년군을 차례로 시도해 같은 원문을 두 번 쓰지 않는다
  const results = await Promise.allSettled(
    todo.map(async (field) => {
      const lists = await Promise.allSettled(FEEDS[field].map(readFeed));
      const items = lists.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const texts = new Map<string, Promise<{ text: string } | { reason: string }>>();
      const tried: string[] = [];
      if (items.length === 0) return lists.map((r) => (r.status === "rejected" ? String(r.reason?.message ?? r.reason) : "")).join(" / ") || "원문 목록이 비어 있음";
      for (const grade of missing(field)) {
        const result = await buildFor(field, grade, items, usedUrls, texts, rejected, deadline);
        if (!("skipped" in result)) {
          await db.saveLibraryArticle(result);
          return [...tried, `추가: ${result.keyword} (${grade})`].join(" / ");
        }
        newlyRejected.push(...result.rejected.map((url) => ({ url, grade })));
        tried.push(`${grade} 건너뜀: ${result.skipped}`);
      }
      return tried.join(" / ");
    }),
  );
  const report: Record<string, string> = {};
  for (const [i, result] of results.entries()) {
    report[todo[i]] =
      result.status === "fulfilled"
        ? result.value
        : `실패: ${result.reason instanceof Error ? result.reason.message : "알 수 없는 오류"}`;
  }
  // 왜 기사가 들어오지 않았는지 나중에 확인할 수 있게 남긴다 (기록에 실패해도 만든 기사는 그대로 둔다)
  await db
    .saveLibraryJobRun({ id: newId(), ranAt: nowIso(), report, rejected: newlyRejected })
    .catch((e) => console.error("library_job_runs 기록 실패", e));
  return report;
}
