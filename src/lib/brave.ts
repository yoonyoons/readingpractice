/**
 * Brave News Search API로 지난 7일 뉴스를 모은다.
 * 문서: https://api-dashboard.search.brave.com/app/documentation/news-search/get-started
 */

const ENDPOINT = "https://api.search.brave.com/res/v1/news/search";
/** 낮은 요금제는 초당 1회 제한이 있어 검색어 사이에 간격을 둔다 */
const GAP_MS = 1100;
const WEEK_MS = 8 * 24 * 60 * 60 * 1000;

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  /** ISO 날짜. 알 수 없으면 빈 문자열 */
  publishedAt: string;
  /** Brave가 함께 주는 본문 발췌(최대 5개) */
  snippets: string[];
}

interface BraveNewsResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  page_age?: string;
  meta_url?: { hostname?: string };
  extra_snippets?: string[];
}

interface BraveNewsResponse {
  results?: BraveNewsResult[];
}

interface SearchOptions {
  country?: "KR" | "US";
  lang?: "ko" | "en";
  count?: number;
  freshness?: "pd" | "pw" | "pm";
}

/** 지난 7일 뉴스를 넓게 모으기 위한 검색어. 정치·날씨는 검색어에서 빼고, 걸려 들어온 것은 아래 필터로 거른다. */
export const WEEKLY_QUERIES: { query: string; country: "KR" | "US"; lang: "ko" | "en" }[] = [
  { query: "이번 주 주요 뉴스", country: "KR", lang: "ko" },
  { query: "사회 이슈", country: "KR", lang: "ko" },
  { query: "경제 소식", country: "KR", lang: "ko" },
  { query: "과학 기술", country: "KR", lang: "ko" },
  { query: "환경 기후", country: "KR", lang: "ko" },
  { query: "교육 학교", country: "KR", lang: "ko" },
  { query: "건강 의료", country: "KR", lang: "ko" },
  { query: "문화 스포츠", country: "KR", lang: "ko" },
  { query: "국제 세계 소식", country: "KR", lang: "ko" },
  { query: "world news this week", country: "US", lang: "en" },
  { query: "science technology news", country: "US", lang: "en" },
  { query: "climate environment news", country: "US", lang: "en" },
  { query: "global economy news", country: "US", lang: "en" },
];

/** 정치(선거·정당·정치인·국회와 정권을 둘러싼 공방)와 일일 날씨 기사를 거르는 1차 규칙 */
const EXCLUDE_PATTERNS = [
  /대통령|대통령실|청와대|국회|여당|야당|정당|의원|선거|총선|대선|지방선거|공천|탄핵|민주당|국민의힘|개혁신당|조국혁신당|정치권|여야|장관 후보|국정감사/,
  /날씨|기상 예보|일기 예보|아침 최저|낮 최고|미세먼지 농도|강수 확률|주말 날씨|내일 (비|눈|기온)/,
  /\b(election|senate|congress|parliament|president trump|white house|prime minister|campaign|ballot)\b/i,
  /\b(weather forecast|today's weather|temperatures? (will|expected)|rain expected)\b/i,
];

export function isExcluded(item: Pick<NewsItem, "title" | "description">) {
  const text = `${item.title} ${item.description}`;
  return EXCLUDE_PATTERNS.some((p) => p.test(text));
}

const ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function cleanText(value: string | undefined) {
  return (value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toItem(raw: BraveNewsResult): NewsItem | null {
  const title = cleanText(raw.title);
  if (!title || !raw.url) return null;
  const time = raw.page_age ? Date.parse(raw.page_age) : NaN;
  return {
    title,
    description: cleanText(raw.description),
    url: raw.url,
    source: raw.meta_url?.hostname ?? new URL(raw.url).hostname,
    publishedAt: Number.isNaN(time) ? "" : new Date(time).toISOString(),
    snippets: (raw.extra_snippets ?? []).map((s) => cleanText(s)).filter(Boolean),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function searchNews(query: string, options: SearchOptions = {}): Promise<NewsItem[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error("BRAVE_API_KEY 환경변수가 필요해요.");

  const params = new URLSearchParams({
    q: query,
    country: options.country ?? "KR",
    search_lang: options.lang ?? "ko",
    count: String(options.count ?? 50),
    freshness: options.freshness ?? "pw",
    extra_snippets: "true",
    safesearch: "strict",
    spellcheck: "false",
  });

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${ENDPOINT}?${params}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429 && attempt < 3) {
      await sleep(GAP_MS * (attempt + 1));
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error("Brave API 키가 올바르지 않거나 크레딧이 없어요.");
    if (!res.ok) throw new Error(`Brave 뉴스 검색 오류 (${res.status})`);
    const data = (await res.json()) as BraveNewsResponse;
    return (data.results ?? []).map(toItem).filter((x): x is NewsItem => x !== null);
  }
}

export interface CollectResult {
  items: NewsItem[];
  /** 검색어별로 받은 기사 수 (디버깅·비용 확인용) */
  perQuery: { query: string; count: number }[];
  excluded: number;
  queriesUsed: number;
}

/** 검색어를 차례로 돌려 지난 7일 기사를 모으고, 중복·정치·날씨를 거른다 */
export async function collectWeeklyNews(queries = WEEKLY_QUERIES): Promise<CollectResult> {
  const lists: NewsItem[][] = [];
  const perQuery: CollectResult["perQuery"] = [];
  let lastError: unknown;

  for (const [i, q] of queries.entries()) {
    if (i > 0) await sleep(GAP_MS);
    try {
      const list = await searchNews(q.query, { country: q.country, lang: q.lang });
      lists.push(list);
      perQuery.push({ query: q.query, count: list.length });
    } catch (error) {
      lastError = error;
      perQuery.push({ query: q.query, count: 0 });
    }
  }
  if (lists.length === 0) throw lastError ?? new Error("뉴스를 가져오지 못했어요.");

  const cutoff = Date.now() - WEEK_MS;
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  let excluded = 0;
  // 검색어별 결과를 번갈아 담아 특정 분야로 쏠리지 않게 한다
  const longest = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const item = list[i];
      if (!item) continue;
      if (item.publishedAt && Date.parse(item.publishedAt) < cutoff) continue;
      const key = item.title.toLowerCase().replace(/[^가-힣a-z0-9]/g, "").slice(0, 40);
      if (!key || seen.has(key) || seen.has(item.url)) continue;
      seen.add(key);
      seen.add(item.url);
      if (isExcluded(item)) {
        excluded++;
        continue;
      }
      items.push(item);
    }
  }
  return { items, perQuery, excluded, queriesUsed: queries.length };
}
