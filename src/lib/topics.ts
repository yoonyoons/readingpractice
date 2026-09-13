import { z } from "zod";
import { isExcluded, searchNews, type NewsItem } from "./brave";
import { generateJson } from "./claude";
import { hasAnthropic } from "./env";
import type { SourceItem } from "./types";

export interface TopicPick {
  name: string;
  summary: string;
  /** 기사 작성 재료. Claude가 정리한 사실 또는 기사 요약문 */
  facts: string[];
  mentionCount: number;
  sources: SourceItem[];
  /** claude: AI가 사건별로 묶어 선정, keywords: 제목 단어 빈도로 선정(AI 키 없을 때) */
  method: "claude" | "keywords";
}

const SYSTEM =
  "너는 대한민국 초등학생·중학생을 위한 시사 교육 콘텐츠 편집자다. 사실에 충실하고, 정치적으로 중립적이며, 학생 눈높이에 맞게 쓴다.";

/** 학습 주제로 고를 수 있는 분야. 정치와 일일 날씨는 목록에 없으므로 고를 수 없다. */
const CATEGORIES = ["사회", "경제", "과학·기술", "환경", "국제", "문화·스포츠", "건강", "교육"] as const;

const TopicSchema = z.object({
  topics: z.array(
    z.object({
      name: z.string(),
      category: z.enum(CATEGORIES),
      summary: z.string(),
      facts: z.array(z.string()),
      headlineIds: z.array(z.number().int()),
    }),
  ),
});

const MAX_HEADLINES = 160;
const MAX_SOURCES = 15;
const MAX_FACTS = 14;

const toSource = (item: NewsItem): SourceItem => ({
  title: item.title,
  url: item.url,
  description: item.description,
  pubDate: item.publishedAt,
});

function factsOf(items: NewsItem[], limit = MAX_FACTS) {
  const seen = new Set<string>();
  const facts: string[] = [];
  for (const item of items) {
    for (const text of [item.description, ...item.snippets]) {
      const key = text.replace(/\s/g, "").slice(0, 40);
      if (text.length < 20 || seen.has(key)) continue;
      seen.add(key);
      facts.push(text);
      if (facts.length >= limit) return facts;
    }
  }
  return facts;
}

/** 모은 뉴스에서 학습 주제 count개를 고른다 */
export async function pickTopicsFromNews(news: NewsItem[], count = 2): Promise<TopicPick[]> {
  const picks = hasAnthropic() ? await clusterWithClaude(news, count) : clusterByKeywords(news, count);
  if (picks.length === 0) throw new Error("학생에게 알맞은 주제를 찾지 못했어요. 잠시 후 다시 시도해 주세요.");
  return Promise.all(picks.slice(0, count).map(enrichTopic));
}

/* ───────────── Claude: 같은 사건끼리 묶어 선정 ───────────── */

async function clusterWithClaude(news: NewsItem[], count: number): Promise<TopicPick[]> {
  const headlines = news.slice(0, MAX_HEADLINES);
  const list = headlines
    .map((n, i) => `[${i}] ${n.title}${n.description ? ` — ${n.description.slice(0, 140)}` : ""}`)
    .join("\n");

  const result = await generateJson(TopicSchema, {
    system: SYSTEM,
    effort: "medium",
    prompt: `아래는 지난 7일 동안 한국과 세계 언론이 보도한 기사 제목과 요약이다. 각 줄은 "[번호] 제목 — 요약" 형식이다.

할 일
1. 같은 사건·이슈를 다룬 기사끼리 묶어라. '경제 소식'처럼 넓은 분야가 아니라 구체적인 사건·이슈 단위로 묶는다.
2. 학생 학습지 주제로 알맞은 묶음 ${count}개를 골라라. 여러 언론이 다룬 중요한 뉴스를 우선하고, 서로 분야가 다르게 고르며, 가능하면 한국 뉴스와 세계 뉴스를 섞는다.
3. 제외: 정치 분야(선거, 정당, 정치인, 국회·정권을 둘러싼 공방), 매일의 날씨 예보. 선정적·잔혹한 범죄나 사고의 상세 내용, 자살, 성 관련 내용, 연예인 사생활, 광고성 기사, 투자 종목 추천.

출력 규칙
- name: 학생이 이해할 수 있는 15자 이내 주제명 (한국어)
- summary: 무슨 일인지 한국어 한 문장
- facts: 위 요약들에서 확인되는 사실만 5~8개, 한국어로 (날짜·수치·기관 포함). 목록에 없는 내용은 쓰지 않는다.
- headlineIds: 그 묶음에 속한 기사 번호 전부

기사 목록
${list}`,
  });

  return result.topics
    .map((t) => {
      const items = [...new Set(t.headlineIds)].filter((i) => i >= 0 && i < headlines.length).map((i) => headlines[i]);
      return {
        name: t.name.trim(),
        summary: t.summary.trim(),
        facts: t.facts.map((f) => f.trim()).filter(Boolean),
        mentionCount: items.length,
        sources: items.slice(0, MAX_SOURCES).map(toSource),
        method: "claude" as const,
      };
    })
    .filter((t) => t.name && t.sources.length > 0);
}

/* ───────────── 대안: 제목 단어 빈도로 선정 (AI 키가 없을 때) ───────────── */

const STOPWORDS = new Set([
  "뉴스", "이번", "주요", "오늘", "속보", "단독", "기자", "종합", "영상", "사진", "위해", "대한", "통해", "관련", "이후",
  "지난", "올해", "내년", "최대", "최소", "가운데", "위한", "대해", "때문", "하는", "있는", "없는", "된다", "한다",
  "됐다", "했다", "라고", "이라고", "것으로", "으로", "에서", "부터", "까지", "News", "news", "The", "the", "and",
  "for", "with", "this", "week", "after", "from", "that", "will", "says", "over", "into", "amid", "new",
]);
const JOSA = /(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|까지|부터|에게|한테|보다|께|처럼|이나|나)$/;

function tokens(title: string) {
  const out = new Set<string>();
  for (const raw of title.split(/[^가-힣a-zA-Z0-9]+/)) {
    let token = raw;
    if (/^[가-힣]+$/.test(token) && token.length > 2) token = token.replace(JOSA, "");
    if (token.length < 2 || /^\d+$/.test(token) || STOPWORDS.has(token)) continue;
    out.add(token);
  }
  return out;
}

export function clusterByKeywords(news: NewsItem[], count: number): TopicPick[] {
  let remaining = news.map((item) => ({ item, tokens: tokens(item.title) }));
  const picks: TopicPick[] = [];

  while (picks.length < count && remaining.length > 0) {
    // 제목에 그 낱말이 들어간 기사 수를 센다. '폭염특보'·'폭염에'처럼 붙어 쓰인 경우도 잡도록 포함 여부로 센다.
    const candidates = new Set<string>();
    for (const entry of remaining) for (const t of entry.tokens) candidates.add(t);
    const freq = [...candidates].map((t) => [t, remaining.filter((e) => e.item.title.includes(t)).length] as const);
    const [keyword, mentions] = freq.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0] ?? [];
    if (!keyword || (mentions ?? 0) < 3) break;

    const cluster = remaining.filter((e) => e.item.title.includes(keyword)).map((e) => e.item);
    remaining = remaining.filter((e) => !e.item.title.includes(keyword));
    picks.push({
      name: keyword,
      summary: cluster[0].title,
      facts: factsOf(cluster),
      mentionCount: cluster.length,
      sources: cluster.slice(0, MAX_SOURCES).map(toSource),
      method: "keywords",
    });
  }
  return picks;
}

/* ───────────── 주제별 추가 검색으로 출처·사실 보강 ───────────── */

async function enrichTopic(topic: TopicPick): Promise<TopicPick> {
  let extra: NewsItem[] = [];
  try {
    extra = (await searchNews(topic.name, { count: 20 })).filter((item) => !isExcluded(item));
  } catch {
    return topic;
  }
  const known = new Set(topic.sources.map((s) => s.url));
  const fresh = extra.filter((item) => !known.has(item.url));
  const facts = [...topic.facts];
  for (const fact of factsOf(fresh, 8)) if (facts.length < MAX_FACTS + 8) facts.push(fact);
  return {
    ...topic,
    facts,
    mentionCount: topic.mentionCount + fresh.length,
    sources: [...topic.sources, ...fresh.map(toSource)].slice(0, MAX_SOURCES + 5),
  };
}
