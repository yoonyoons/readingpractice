import { z } from "zod";
import { fetchArticle } from "./article-fetch";
import { generateJson } from "./claude";
import { getDb } from "./db";
import { isDemoGeneration } from "./env";
import { buildArticle } from "./generation";
import { GRADE_LIST, isGradeLevel } from "./grades";
import { FIELD_ORDER, LIBRARY_FIELDS, listLibraryArticles } from "./library";
import type { GradeLevel, LibraryArticle, LibraryField, LibraryLicense } from "./types";
import { newId, nowIso, weekStartIso } from "./utils";

/**
 * 관심 분야 학습 자동 추가: 매주 분야마다 기사 1편.
 * 매일 Cron(06:00 KST)에서 부르지만, 이번 주(서울 월요일 기준)에 그 분야 자동 기사가 이미 있으면 건너뛴다.
 * 이번 주 기사 준비로 바쁜 월요일은 쉬고 화요일부터 만든다. 실패하면 다음 날 다시 시도한다.
 */

interface Feed {
  url: string;
  site: string;
  /** public-domain: 미국 정부 기관 공공 저작물, reference: 저작권이 있는 공공기관 자료라 내용만 참고해 새로 쓴다 */
  license: LibraryLicense;
}

/** 원문 복제·재가공이 가능하거나 교육 목적 참고가 가능한 공공 기관의 RSS */
const FEEDS: Record<LibraryField, Feed[]> = {
  space: [
    { url: "https://science.nasa.gov/feed/", site: "NASA Science", license: "public-domain" },
    { url: "https://www.nasa.gov/feed/", site: "NASA", license: "public-domain" },
  ],
  earth: [{ url: "https://www.noaa.gov/rss.xml", site: "NOAA", license: "public-domain" }],
  economy: [{ url: "https://www.federalreserve.gov/feeds/press_all.xml", site: "미국 연방준비제도(Federal Reserve)", license: "public-domain" }],
  culture: [
    { url: "https://webzine.nfm.go.kr/feed/", site: "국립민속박물관 웹진", license: "reference" },
    { url: "https://blogs.loc.gov/loc/feed/", site: "미국 의회도서관(Library of Congress)", license: "public-domain" },
  ],
};

const ANALYZE_MODEL = "claude-haiku-4-5-20251001";
const MAX_CANDIDATES = 4;
const FEED_TIMEOUT_MS = 15000;

interface FeedItem {
  title: string;
  url: string;
  feed: Feed;
}

const decode = (text: string) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#8217;/g, "'")
    .trim();

async function readFeed(feed: Feed): Promise<FeedItem[]> {
  const res = await fetch(feed.url, {
    headers: { "user-agent": "Mozilla/5.0 (readingpractice education bot)" },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${feed.site} RSS ${res.status}`);
  const xml = await res.text();
  const items: FeedItem[] = [];
  for (const [, body] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const title = decode(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const url = decode(body.match(/<link\b[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? "");
    if (title && /^https?:\/\//.test(url)) items.push({ title, url, feed });
  }
  return items;
}

const AnalysisSchema = z.object({
  suitable: z.boolean(),
  reason: z.string(),
  keyword: z.string(),
  title: z.string(),
  gradeLevels: z.array(z.string()),
  curriculum: z.string(),
  summary: z.string(),
  facts: z.array(z.string()),
});

const SYSTEM =
  "너는 대한민국 초등학생·중학생을 위한 교육 콘텐츠 편집자이자 저작권 검토자다. 우리나라 교육과정을 잘 알고, 사실에 충실하며, 정치적으로 중립적이다.";

async function analyze(field: LibraryField, item: FeedItem, text: string) {
  const grades = GRADE_LIST.map((g) => `${g.level}(${g.label})`).join(", ");
  return generateJson(AnalysisSchema, {
    model: ANALYZE_MODEL,
    system: SYSTEM,
    prompt: `[분야] ${LIBRARY_FIELDS[field].label}
[출처] ${item.feed.site} — ${item.title}
[주소] ${item.url}

[원문]
${text}

위 원문으로 학생이 상시로 읽을 '${LIBRARY_FIELDS[field].label}' 분야 읽기 자료를 만들 수 있는지 판단하라.

suitable을 false로 하는 경우
- 원문에 기관이 아닌 외부 작가·사진가·언론사의 저작권 표시가 있거나, 다른 매체 글을 옮겨 실은 글(© 표시, "Reprinted with permission", "Guest post", "Courtesy of" 등). 사이트 맨 아래의 일반적인 저작권 문구는 해당하지 않는다.
- 인사 발령, 행사 안내, 입찰, 조직 소식, 보도 일정처럼 학생이 배울 내용이 거의 없는 글
- 정치적 논쟁, 특정 정당·정치인 평가, 폭력·재난 피해 묘사가 중심인 글
- 우리나라 초3~중학교 교육과정의 어느 단원과도 이어지지 않는 글
reason에는 판단 까닭을 한 문장으로 쓴다.

suitable이 true이면
- gradeLevels: 이 내용을 우리나라 교육과정(2022 개정)에서 실제로 배우는 학년군만 고른다. 고를 수 있는 값: ${grades}. 억지로 여러 학년군에 넣지 말고, 관련 단원이 있는 학년군만 넣는다(보통 1개, 많아야 2개).
- curriculum: 관련 단원 예) "초5~6 과학 '태양계와 별'"
- keyword: 학생이 상자에서 보고 누를 짧은 한국어 키워드(2~8자). 예) "화성", "엘니뇨", "기준금리"
- title: 학생용 한국어 제목(25자 이내)
- summary: 무엇에 관한 글인지 한 문장
- facts: 원문에서 확인되는 사실 6~12개를 한국어 한 문장씩. 원문에 없는 숫자·이름·날짜를 지어내지 않는다.
suitable이 false이면 나머지 칸은 빈 값으로 둔다.`,
  });
}

async function buildFor(field: LibraryField, usedUrls: Set<string>): Promise<LibraryArticle | { skipped: string }> {
  const lists = await Promise.allSettled(FEEDS[field].map(readFeed));
  const items = lists
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((item) => !usedUrls.has(item.url))
    .slice(0, MAX_CANDIDATES);
  if (items.length === 0) return { skipped: "새 원문 없음" };

  const reasons: string[] = [];
  for (const item of items) {
    usedUrls.add(item.url);
    let text: string;
    try {
      text = (await fetchArticle(item.url)).text;
    } catch (error) {
      reasons.push(`${item.title}: ${error instanceof Error ? error.message : "가져오기 실패"}`);
      continue;
    }
    if (text.length < 600) {
      reasons.push(`${item.title}: 본문이 짧음`);
      continue;
    }
    const analysis = await analyze(field, item, text);
    const gradeLevels = [...new Set(analysis.gradeLevels.filter(isGradeLevel))] as GradeLevel[];
    if (!analysis.suitable || gradeLevels.length === 0 || analysis.facts.length < 4) {
      reasons.push(`${item.title}: ${analysis.reason || "학습 자료로 알맞지 않음"}`);
      continue;
    }
    // 여러 학년군이 맞으면 가장 낮은 학년군 수준으로 써서 모두가 읽을 수 있게 한다
    const writeFor = GRADE_LIST.find((g) => gradeLevels.includes(g.level))!.level;
    const sources = [{ title: `${item.feed.site} — ${item.title}`, url: item.url, description: "", pubDate: "" }];
    const built = await buildArticle(
      { name: analysis.keyword, summary: analysis.summary, facts: analysis.facts, sources },
      writeFor,
      false,
    );
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
      gradeLevels,
      curriculum: analysis.curriculum,
      origin: { site: item.feed.site, title: item.title, url: item.url, license: item.feed.license },
      addedBy: "auto",
      createdAt: nowIso(),
    };
  }
  return { skipped: reasons.join(" / ") || "알맞은 원문 없음" };
}

export async function runLibraryJob(now = new Date()) {
  if (isDemoGeneration()) return { skipped: "AI·검색 키가 없어 자동 추가를 하지 않아요" };
  const seoulDay = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCDay();
  if (seoulDay === 1) return { skipped: "월요일은 이번 주 기사 준비로 쉬어요" };

  const weekStart = weekStartIso(now);
  const articles = await listLibraryArticles();
  const usedUrls = new Set(articles.map((a) => a.origin.url));
  const todo = FIELD_ORDER.filter(
    (field) => !articles.some((a) => a.field === field && a.addedBy === "auto" && a.createdAt >= weekStart),
  );
  if (todo.length === 0) return { skipped: "이번 주 분야별 기사가 모두 있어요" };

  const results = await Promise.allSettled(todo.map((field) => buildFor(field, usedUrls)));
  const report: Record<string, string> = {};
  for (const [i, result] of results.entries()) {
    const field = todo[i];
    if (result.status === "rejected") {
      report[field] = `실패: ${result.reason instanceof Error ? result.reason.message : "알 수 없는 오류"}`;
    } else if ("skipped" in result.value) {
      report[field] = `건너뜀: ${result.value.skipped}`;
    } else {
      await getDb().saveLibraryArticle(result.value);
      report[field] = `추가: ${result.value.keyword} (${result.value.gradeLevels.join(",")})`;
    }
  }
  return report;
}
