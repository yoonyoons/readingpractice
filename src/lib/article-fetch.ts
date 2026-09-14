import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { HttpError } from "./http";

/** 교사가 붙여넣은 기사 주소에서 뽑아낸 내용 */
export interface FetchedArticle {
  url: string;
  title: string;
  description: string;
  siteName: string;
  publishedAt: string;
  text: string;
}

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_TEXT = 12000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 15000;
const PASTE_HINT = "'본문 직접 붙여넣기'로 기사 내용을 넣어 주세요.";

export function parseArticleUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(400, "기사 주소(URL)를 정확히 붙여넣어 주세요. https:// 로 시작해야 해요.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpError(400, "기사 주소는 https:// 또는 http:// 로 시작해야 해요.");
  }
  if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) {
    throw new HttpError(400, "이 주소는 가져올 수 없어요.");
  }
  return url;
}

/** 서버 내부망·예약 주소로 요청을 보내지 않도록 막는다 */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a.startsWith("::ffff:")) return isPrivateAddress(a.slice(7));
    return a === "::" || a === "::1" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a);
  }
  if (isIP(address) !== 4) return true;
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host)) {
    throw new HttpError(400, "이 주소는 가져올 수 없어요.");
  }
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map((r) => r.address);
    } catch {
      throw new HttpError(400, "기사 주소를 찾을 수 없어요. URL을 다시 확인해 주세요.");
    }
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new HttpError(400, "이 주소는 가져올 수 없어요.");
  }
}

/** 기사 페이지를 가져와 제목·본문을 뽑는다 */
export async function fetchArticle(raw: string): Promise<FetchedArticle> {
  let url = parseArticleUrl(raw);
  let res: Response;
  for (let hop = 0; ; hop++) {
    await assertPublicHost(url);
    try {
      res = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
        },
      });
    } catch {
      throw new HttpError(502, `기사 페이지에 접속하지 못했어요. 주소를 확인하거나 ${PASTE_HINT}`);
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop >= MAX_REDIRECTS) throw new HttpError(502, `기사 페이지가 너무 여러 번 다른 주소로 넘어가요. ${PASTE_HINT}`);
      url = parseArticleUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }

  if (!res.ok) {
    throw new HttpError(
      502,
      `기사 페이지를 가져오지 못했어요(응답 ${res.status}). 유료·로그인 기사이거나 사이트가 외부 접근을 막아 둔 경우예요. ${PASTE_HINT}`,
    );
  }
  const type = res.headers.get("content-type") ?? "";
  if (type && !/html|xml|text\/plain/i.test(type)) {
    throw new HttpError(400, "웹 기사 페이지 주소만 가져올 수 있어요. PDF·이미지 주소는 안 돼요.");
  }
  const html = decode(await readLimited(res), type);
  return extractArticle(html, url.toString());
}

/** URL로 본문을 못 가져올 때 교사가 붙여넣은 본문을 같은 형태로 만든다 */
export function pastedArticle(text: string, rawUrl: string): FetchedArticle {
  const url = rawUrl.trim() ? parseArticleUrl(rawUrl).toString() : "";
  return {
    url,
    title: "",
    description: "",
    siteName: url ? new URL(url).hostname : "직접 붙여넣은 기사",
    publishedAt: "",
    text: normalizeLines(text).slice(0, MAX_TEXT),
  };
}

async function readLimited(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    // 기사 본문은 앞부분에 있으므로 너무 큰 페이지는 여기까지만 읽는다
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  return Buffer.concat(chunks);
}

function decode(bytes: Uint8Array, contentType: string) {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const charset =
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset.toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/* ───────────── HTML에서 기사 본문 뽑기 ───────────── */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
};

function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function normalizeLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function toText(html: string) {
  return normalizeLines(
    decodeEntities(
      html
        .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/blockquote)\b[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function attributes(tag: string) {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
  }
  return out;
}

function findArticleBody(node: unknown, depth = 0): string {
  if (depth > 6 || node == null || typeof node !== "object") return "";
  if (Array.isArray(node)) {
    return node.map((n) => findArticleBody(n, depth + 1)).reduce((a, b) => (b.length > a.length ? b : a), "");
  }
  const record = node as Record<string, unknown>;
  if (typeof record.articleBody === "string") return record.articleBody;
  return Object.values(record)
    .map((v) => findArticleBody(v, depth + 1))
    .reduce((a, b) => (b.length > a.length ? b : a), "");
}

/** 군더더기가 많은 영역. 통째로 지운다 */
const NOISE =
  /<(script|style|noscript|svg|iframe|form|header|footer|nav|aside|figcaption|button|select|template)\b[\s\S]*?<\/\1\s*>/gi;

/** 주요 언론사가 기사 본문 영역에 붙이는 id·class */
const BODY_HINT =
  /<(?:div|section|article)\b[^>]*(?:id|class)\s*=\s*["'][^"']*(?:dic_area|newsct_article|article[_-]?body|articlebody|article[_-]?txt|article[_-]?view|article[_-]?content|news[_-]?body|news[_-]?content|news[_-]?text|view[_-]?con|story[_-]?body|content[_-]?body|entry[_-]?content|post[_-]?content)[^"']*["'][^>]*>/i;

const MIN_BODY = 200;

export function extractArticle(html: string, url: string): FetchedArticle {
  const metas: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
    if (key && a.content && !metas[key]) metas[key] = decodeEntities(a.content).trim();
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const title = metas["og:title"] || metas["twitter:title"] || (titleTag ? toText(titleTag) : "");
  const description = metas["og:description"] || metas["description"] || "";
  const publishedAt = metas["article:published_time"] || metas["og:regdate"] || metas["pubdate"] || "";
  const siteName = metas["og:site_name"] || new URL(url).hostname;

  // 1) 검색엔진용 구조화 데이터(JSON-LD)의 articleBody
  let text = "";
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const body = normalizeLines(decodeEntities(findArticleBody(JSON.parse(m[1]))));
      if (body.length > text.length) text = body;
    } catch {
      // 잘못된 JSON은 건너뛴다
    }
  }

  if (text.length < MIN_BODY) {
    const cleaned = html.replace(/<!--[\s\S]*?-->/g, "").replace(NOISE, " ");
    const candidates: string[] = [];
    // 2) 본문 영역 id·class  3) <article>  4) <p> 문단 모음
    const hint = BODY_HINT.exec(cleaned);
    if (hint) {
      const rest = cleaned.slice(hint.index, hint.index + 60000);
      const end = rest.search(/<\/article>/i);
      candidates.push(toText(end > 0 ? rest.slice(0, end) : rest));
    }
    const article = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(cleaned)?.[1];
    if (article) candidates.push(toText(article));
    candidates.push(
      [...cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((p) => toText(p[1]))
        .filter((t) => t.length >= 30)
        .join("\n"),
    );
    text = candidates.find((c) => c.length >= MIN_BODY) ?? "";
    // 5) 그래도 없으면 페이지 전체에서 긴 줄만
    if (!text) {
      const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(cleaned)?.[1] ?? cleaned;
      text = toText(body)
        .split("\n")
        .filter((line) => line.length >= 25)
        .join("\n");
    }
  }

  return { url, title, description, siteName, publishedAt, text: text.slice(0, MAX_TEXT) };
}
