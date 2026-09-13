import { z } from "zod";
import { generateJson, researchWithWebSearch } from "./claude";
import { DEMO_OPINIONS, DEMO_TOPICS } from "./demo-data";
import { isDemoGeneration } from "./env";
import { GRADES } from "./grades";
import type { Article, GradeLevel, QuizItem, QuizType, SourceItem } from "./types";
import { BLANK, newId, shuffle } from "./utils";

const SYSTEM =
  "너는 대한민국 초등학생·중학생을 위한 시사 교육 콘텐츠 편집자다. 사실에 충실하고, 정치적으로 중립적이며, 학생 눈높이에 맞게 쓴다.";

export interface TopicPick {
  name: string;
  summary: string;
  facts: string[];
  mentionCount: number;
  sources: SourceItem[];
}

/** 학습 주제로 고를 수 있는 분야. 정치와 일일 날씨는 목록에 없으므로 고를 수 없다. */
const CATEGORIES = ["사회", "경제", "과학·기술", "환경", "국제", "문화·스포츠", "건강", "교육"] as const;

const TopicSchema = z.object({
  topics: z.array(
    z.object({
      name: z.string(),
      category: z.enum(CATEGORIES),
      summary: z.string(),
      facts: z.array(z.string()),
      sourceIds: z.array(z.number().int()),
    }),
  ),
});

function seoulDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export async function pickTopics(count = 2): Promise<TopicPick[]> {
  if (isDemoGeneration()) {
    await sleep(800);
    return DEMO_TOPICS.slice(0, count).map((t) => ({
      name: t.topic,
      summary: t.topicSummary,
      facts: [],
      mentionCount: t.sources.length,
      sources: t.sources,
    }));
  }

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const research = await researchWithWebSearch({
    system: SYSTEM,
    maxSearches: 12,
    prompt: `오늘은 ${seoulDate(today)}이다. 웹 검색으로 ${seoulDate(weekAgo)}부터 오늘까지 한국과 세계에서 여러 언론이 크게 다룬 주요 뉴스를 조사하라.

조사 기준
- 초·중학생이 알아 두면 좋은 사회, 경제, 과학·기술, 환경, 국제, 문화·스포츠, 건강, 교육 분야의 사건·이슈를 찾는다.
- 제외: 정치 분야(선거, 정당, 정치인, 국회·정권을 둘러싼 공방), 매일의 날씨 예보·기상 소식. 선정적·잔혹한 범죄나 사고의 상세 내용, 자살, 성 관련 내용, 연예인 사생활, 광고성 기사.
- 서로 분야가 다른 후보를 ${count + 2}개 정도 조사하고, 가능하면 한국 뉴스와 세계 뉴스를 섞는다.
- 각 후보마다 무슨 일인지, 날짜·수치·기관 이름이 들어간 확인된 사실 5~8개, 의견이 갈리면 서로 다른 입장을 정리한다. 사실마다 근거가 된 기사를 인용한다.`,
  });
  if (research.sources.length === 0) {
    throw new Error("웹에서 이번 주 뉴스를 찾지 못했어요. 잠시 후 다시 시도해 주세요.");
  }

  const sourceList = research.sources.slice(0, 40);
  const result = await generateJson(TopicSchema, {
    system: SYSTEM,
    effort: "medium",
    prompt: `아래는 지난 7일 주요 뉴스를 웹 검색으로 조사한 노트와 출처 목록이다.

[조사 노트]
${research.text}

[출처 목록]
${sourceList.map((s, i) => `[${i}] ${s.title} (${s.url})`).join("\n")}

이 가운데 학생 학습지 주제로 가장 알맞은 ${count}개를 골라라.
- 여러 언론이 다룬 중요한 뉴스를 우선하고, 서로 분야가 다른 주제를 고른다. 가능하면 한국 뉴스와 세계 뉴스를 섞는다.
- 정치 분야와 일일 날씨 소식은 고르지 않는다.
- name: 학생이 이해할 수 있는 15자 이내 주제명
- summary: 무슨 일인지 한 문장
- facts: 조사 노트에서 확인된 사실만 5~8개(날짜·수치·기관 포함). 노트에 없는 내용은 쓰지 않는다.
- sourceIds: 그 주제의 근거가 된 출처 번호`,
  });

  const picks = result.topics
    .map((t) => {
      const sources = [...new Set(t.sourceIds)]
        .filter((i) => i >= 0 && i < sourceList.length)
        .map((i) => ({ title: sourceList[i].title, url: sourceList[i].url, description: "", pubDate: sourceList[i].pageAge }));
      return {
        name: t.name.trim(),
        summary: t.summary.trim(),
        facts: t.facts.map((f) => f.trim()).filter(Boolean),
        mentionCount: sources.length,
        sources,
      };
    })
    .filter((t) => t.facts.length > 0 && t.sources.length > 0);

  if (picks.length === 0) throw new Error("학생에게 알맞은 주제를 찾지 못했어요. 잠시 후 다시 시도해 주세요.");
  return picks.slice(0, count);
}

const QuizDraftSchema = z.object({
  type: z.enum(["blank", "synonym", "comprehension"]),
  prompt: z.string(),
  sentence: z.string(),
  target: z.string(),
  choices: z.array(z.string()),
  answer: z.string(),
  explanation: z.string(),
});

const ArticleDraftSchema = z.object({
  title: z.string(),
  whyItMatters: z.string(),
  paragraphs: z.array(z.string()),
  vocab: z.array(z.object({ word: z.string(), meaning: z.string() })),
  quiz: z.array(QuizDraftSchema),
  keyPoints: z.array(z.string()),
  modelSummary: z.string(),
  opinionQuestion: z.string(),
  stances: z.array(z.string()),
});

export type ArticleDraft = z.infer<typeof ArticleDraftSchema>;

export type BuiltArticle = Pick<
  Article,
  | "title"
  | "whyItMatters"
  | "paragraphs"
  | "vocab"
  | "quiz"
  | "keyPoints"
  | "modelSummary"
  | "opinionQuestion"
  | "stances"
  | "sourceMode"
>;

const TYPE_ORDER: Record<QuizType, number> = { blank: 0, synonym: 1, comprehension: 2 };
const DEFAULT_STANCES = ["그렇다고 생각해요", "아니라고 생각해요"];

/** AI가 만든 초안을 검증해 학생에게 내보낼 수 있는 형태로 바꾼다. 형식이 맞지 않는 문항은 버린다. */
export function normalizeDraft(draft: ArticleDraft): Omit<BuiltArticle, "sourceMode"> {
  const paragraphs = draft.paragraphs.map((p) => p.trim()).filter(Boolean);
  const body = paragraphs.join(" ");
  const vocab = draft.vocab
    .map((v) => ({ word: v.word.trim(), meaning: v.meaning.trim() }))
    .filter((v) => v.word && v.meaning && body.includes(v.word));

  const quiz: QuizItem[] = [];
  for (const q of draft.quiz) {
    const choices = [...new Set(q.choices.map((c) => c.trim()).filter(Boolean))];
    const answer = q.answer.trim();
    if (choices.length !== 4 || !choices.includes(answer)) continue;

    let sentence = q.sentence.trim();
    let prompt = q.prompt.trim();
    let target = "";
    if (q.type === "blank") {
      if (!sentence.includes(answer)) continue;
      sentence = sentence.replace(answer, BLANK);
      prompt ||= "빈칸에 들어갈 알맞은 낱말은 무엇인가요?";
    } else if (q.type === "synonym") {
      target = q.target.trim();
      if (!target || !sentence.includes(target)) continue;
      prompt ||= `'${target}'와(과) 뜻이 가장 비슷한 말은 무엇인가요?`;
    } else {
      sentence = "";
    }
    if (!prompt) continue;

    const shuffled = shuffle(choices);
    quiz.push({
      id: newId(),
      type: q.type,
      prompt,
      sentence,
      target,
      choices: shuffled,
      answer: shuffled.indexOf(answer),
      explanation: q.explanation.trim(),
    });
  }
  quiz.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);

  const stances = [...new Set(draft.stances.map((s) => s.trim()).filter(Boolean))].slice(0, 3);

  return {
    title: draft.title.trim(),
    whyItMatters: draft.whyItMatters.trim(),
    paragraphs,
    vocab,
    quiz,
    keyPoints: draft.keyPoints.map((k) => k.trim()).filter(Boolean).slice(0, 5),
    modelSummary: draft.modelSummary.trim(),
    opinionQuestion: draft.opinionQuestion.trim(),
    stances: stances.length >= 2 ? stances : DEFAULT_STANCES,
  };
}

export async function buildArticle(
  topic: { name: string; summary: string; facts: string[]; sources: SourceItem[] },
  grade: GradeLevel,
): Promise<BuiltArticle> {
  if (isDemoGeneration()) {
    await sleep(900);
    const demo = DEMO_TOPICS.find((t) => t.topic === topic.name) ?? DEMO_TOPICS[0];
    return { ...normalizeDraft({ ...demo.draft, ...DEMO_OPINIONS[demo.topic] }), sourceMode: "demo" };
  }

  const g = GRADES[grade];
  const facts = topic.facts.length
    ? topic.facts.map((f) => `- ${f}`).join("\n")
    : `- ${topic.summary} (자세한 사실 정보가 없으니 이 문장의 범위를 벗어나지 않는다)`;
  const sources = topic.sources.map((s) => `- ${s.title} (${s.url})`).join("\n");

  const prompt = `[학년군] ${g.label}
[주제] ${topic.name} — ${topic.summary}

[웹 검색으로 확인한 사실]
${facts}

[출처]
${sources}

위 사실을 바탕으로 ${g.label} 학생이 읽을 시사 기사를 새로 써라. 출처 기사의 문장을 그대로 옮기지 말고 새로 쓴다.

글쓰기 규칙
- 위 사실에 있는 내용만 쓴다. 사실에 없는 숫자·이름·날짜·인용을 지어내지 않는다.
- 의견이 갈리는 문제는 한쪽 입장만 쓰지 말고 서로 다른 입장을 함께 소개한다. 특정 정당·인물을 칭찬하거나 비난하지 않는다.
- 분량: 본문 ${g.bodyChars}, 문단 ${g.paragraphs}. paragraphs 배열의 원소 하나가 문단 하나다.
- 문장: ${g.sentence}.
- 어휘: ${g.vocab}.
- 문체: ${g.tone}.
- 첫 문단에서 무슨 일이 있었는지(누가·무엇을·어떻게) 먼저 알려 주고, 이어서 까닭과 배경, 영향, 앞으로의 과제 순서로 쓴다.
- title: 25자 이내. whyItMatters: 이 소식이 학생의 생활이나 우리 사회와 어떻게 이어지는지 한두 문장.

핵심 어휘(vocab)
- 본문에 실제로 쓰인 낱말 중 이 학년 학생이 꼭 알아야 할 중요한 낱말 ${g.vocabCount}개.
- word는 본문에 쓰인 글자 그대로(조사 제외), meaning은 학년 수준에 맞는 한 문장 풀이.

퀴즈(quiz): 모두 7문항, 모든 문항은 보기(choices) 4개와 정답(answer) 1개
- blank 3문항: sentence는 본문 문장을 글자 그대로 가져온다. answer는 그 문장 속 핵심 어휘(글자 그대로)다. 오답 보기는 품사가 같지만 문맥에 맞지 않는 낱말. prompt는 "빈칸에 들어갈 알맞은 낱말은 무엇인가요?", target은 빈 문자열.
- synonym 2문항: sentence는 본문 문장을 글자 그대로, target은 그 문장 속 낱말(글자 그대로), prompt는 "'target'와(과) 뜻이 가장 비슷한 말은 무엇인가요?" 형태, answer는 target과 뜻이 비슷하고 그 자리에 바꿔 넣어도 자연스러운 말.
- comprehension 2문항: 기사 내용을 제대로 이해했는지 묻는 질문. sentence와 target은 빈 문자열. 오답은 헷갈릴 만하지만 기사 내용과 분명히 다른 것.
- answer는 choices 가운데 하나와 글자까지 똑같아야 한다. explanation은 정답인 까닭을 학년 수준에 맞게 한두 문장.

keyPoints: 좋은 요약에 꼭 들어가야 할 핵심 내용 3개(각 한 문장).
modelSummary: ${g.modelSummaryLength} 분량의 모범 요약.

생각 나누기
- opinionQuestion: 기사를 읽은 학생이 자기 입장을 정하고 까닭을 쓸 수 있는 열린 질문 1개. 학생의 생활과 이어지면 더 좋다. 정답이 정해진 질문, 특정 정당·정치인·종교를 지지하는지 묻는 질문은 쓰지 않는다.
- stances: 학생이 고를 입장 2~3개(각 15자 이내). 찬반이 갈리는 질문이면 "찬성해요", "반대해요"처럼, 아니면 서로 다른 선택지로 쓴다.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const normalized = normalizeDraft(await generateJson(ArticleDraftSchema, { system: SYSTEM, prompt }));
    if (normalized.quiz.length >= 5 && normalized.paragraphs.length >= 3 && normalized.keyPoints.length >= 2) {
      return { ...normalized, sourceMode: "web" };
    }
  }
  throw new Error("AI가 만든 퀴즈가 형식에 맞지 않아요. 이 기사만 다시 만들어 주세요.");
}

/** 기사들을 동시에 만들고, 하나가 끝날 때마다 onProgress를 부른다. 실패한 기사는 failed 상태로 남긴다. */
export async function buildAllArticles(
  articles: Article[],
  grade: GradeLevel,
  onProgress?: (index: number, article: Article) => void,
): Promise<Article[]> {
  const result = [...articles];
  await Promise.all(
    articles.map(async (article, index) => {
      try {
        const built = await buildArticle(
          { name: article.topic, summary: article.topicSummary, facts: article.facts ?? [], sources: article.sources },
          grade,
        );
        result[index] = { ...article, ...built, status: "ready", error: undefined };
      } catch (error) {
        result[index] = {
          ...article,
          status: "failed",
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        };
      }
      onProgress?.(index, result[index]);
    }),
  );
  return result;
}

/** 다른 반 학습지에 넣을 수 있도록 기사·퀴즈 id를 새로 매긴 복사본을 만든다 */
export function cloneArticles(articles: Article[]): Article[] {
  return structuredClone(articles).map((article) => ({
    ...article,
    id: newId(),
    quiz: article.quiz.map((q) => ({ ...q, id: newId() })),
  }));
}

export function emptyArticle(topic: TopicPick): Article {
  return {
    id: newId(),
    topic: topic.name,
    topicSummary: topic.summary,
    facts: topic.facts,
    mentionCount: topic.mentionCount,
    status: "pending",
    sourceMode: "web",
    sources: topic.sources,
    title: "",
    whyItMatters: "",
    paragraphs: [],
    vocab: [],
    quiz: [],
    keyPoints: [],
    modelSummary: "",
    opinionQuestion: "",
    stances: [],
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
