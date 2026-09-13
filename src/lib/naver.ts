import * as cheerio from "cheerio";

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  pubDate: string;
}

interface NaverNewsResponse {
  items: { title: string; originallink: string; link: string; description: string; pubDate: string }[];
}

/** 인기 주제 순위 API가 없으므로, 넓은 분야 검색어로 한 주 기사를 모은 뒤 AI가 사건별로 묶는다 */
const KEYWORDS = ["정부", "국회", "경제", "물가", "사회", "국제", "과학", "기술", "환경", "기후", "교육", "건강", "문화", "스포츠"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 700;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&middot;": "·",
  "&hellip;": "…",
};

export function cleanText(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchNews(query: string, sort: "sim" | "date") {
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=100&start=1&sort=${sort}`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID!,
      "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET!,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`네이버 뉴스 API 오류 (${res.status})`);
  const data = (await res.json()) as NaverNewsResponse;
  return data.items ?? [];
}

export async function collectWeeklyNews(): Promise<NewsItem[]> {
  const jobs = KEYWORDS.flatMap((k) => [
    () => searchNews(k, "sim"),
    () => searchNews(k, "date"),
  ]);

  const results: NaverNewsResponse["items"][] = [];
  let lastError: unknown;
  // 네이버 API 초당 호출 제한을 넘지 않도록 4개씩 나눠 호출
  for (let i = 0; i < jobs.length; i += 4) {
    const settled = await Promise.allSettled(jobs.slice(i, i + 4).map((job) => job()));
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(r.value);
      else lastError = r.reason;
    }
  }
  if (results.length === 0) throw lastError ?? new Error("뉴스를 가져오지 못했어요.");

  const cutoff = Date.now() - WEEK_MS;
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  // 검색어별 결과를 번갈아 가며 담아 특정 분야로 쏠리지 않게 한다
  const maxLength = Math.max(...results.map((r) => r.length));
  for (let i = 0; i < maxLength && items.length < MAX_ITEMS; i++) {
    for (const list of results) {
      const raw = list[i];
      if (!raw) continue;
      const time = Date.parse(raw.pubDate);
      if (Number.isNaN(time) || time < cutoff) continue;
      const title = cleanText(raw.title);
      const key = title.replace(/[^가-힣a-zA-Z0-9]/g, "").slice(0, 30);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({
        title,
        description: cleanText(raw.description),
        url: raw.link || raw.originallink,
        pubDate: new Date(time).toISOString(),
      });
    }
  }
  return items;
}

/** 네이버 뉴스(n.news.naver.com)에 실린 기사의 본문을 가져온다. 실패하면 null */
export async function crawlArticle(url: string): Promise<string | null> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (!host.endsWith("news.naver.com")) return null;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());
    const body = $("#dic_area, #newsct_article, #articeBody").first();
    if (!body.length) return null;
    body.find("script, style, .img_desc, .end_photo_org, .vod_player_wrap, table").remove();
    body.find("br").replaceWith("\n");
    const text = body
      .text()
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
    return text.length >= 200 ? text.slice(0, 4000) : null;
  } catch {
    return null;
  }
}
