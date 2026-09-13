import { z } from "zod";
import { DEMO_TOPICS } from "./demo-data";
import { isDemoGeneration } from "./env";
import { generateJson } from "./gemini";
import { GRADES } from "./grades";
import { collectWeeklyNews, crawlArticle } from "./naver";
import type { Article, GradeLevel, QuizItem, QuizType, SourceItem } from "./types";
import { BLANK, newId, shuffle } from "./utils";

const SYSTEM =
  "너는 대한민국 초등학생·중학생을 위한 시사 교육 콘텐츠 편집자다. 사실에 충실하고, 정치적으로 중립적이며, 학생 눈높이에 맞게 쓴다.";

export interface TopicPick {
  name: string;
  summary: string;
  mentionCount: number;
  sources: SourceItem[];
}

const ClusterSchema = z.object({
  topics: z.array(
    z.object({
      name: z.string(),
      summary: z.string(),
      suitable: z.boolean(),
      headlineIds: z.array(z.number().int()),
    }),
  ),
});

const isNaverLink = (url: string) => url.includes("news.naver.com");

export async function pickTopics(count = 3): Promise<TopicPick[]> {
  if (isDemoGeneration()) {
    await sleep(800);
    return DEMO_TOPICS.slice(0, count).map((t) => ({
      name: t.topic,
      summary: t.topicSummary,
      mentionCount: t.mentionCount,
      sources: t.sources,
    }));
  }

  const news = await collectWeeklyNews();
  if (news.length < 20) throw new Error("지난 일주일 기사를 충분히 모으지 못했어요.");

  const headlines = news.map((n, i) => `[${i}] ${n.title} — ${n.description.slice(0, 80)}`).join("\n");
  const result = await generateJson(ClusterSchema, {
    system: SYSTEM,
    temperature: 0.2,
    prompt: `아래는 지난 7일 동안 네이버 뉴스에 올라온 기사 제목과 요약이다. 각 줄은 "[번호] 제목 — 요약" 형식이다.

할 일
1. 같은 사건·이슈를 다룬 기사끼리 묶어라. 같은 사건의 후속 보도도 같은 묶음이다. '경제 소식'처럼 넓은 분야로 묶지 말고 구체적인 사건·이슈 단위로 묶어라.
2. 기사 수가 많은 묶음부터 최대 8개를 골라라.
3. 각 묶음이 학생 학습 자료로 알맞은지 판단해 suitable에 적어라. 다음은 부적절(false)이다: 선정적·잔혹한 범죄나 사고의 상세 묘사, 자살, 성 관련 내용, 연예인 사생활·가십, 특정 정당·정치인 지지나 비방이 중심인 내용, 광고성 기사, 투자 종목 추천.

출력 규칙
- name: 학생이 이해할 수 있는 15자 이내 주제명
- summary: 무슨 일인지 한 문장
- headlineIds: 그 묶음에 속한 기사 번호 전부

기사 목록
${headlines}`,
  });

  const picks = result.topics
    .filter((t) => t.suitable)
    .map((t) => {
      const ids = [...new Set(t.headlineIds)].filter((i) => i >= 0 && i < news.length);
      const sources = ids
        .map((i) => news[i])
        .sort((a, b) => Number(isNaverLink(b.url)) - Number(isNaverLink(a.url)))
        .slice(0, 15);
      return { name: t.name.trim(), summary: t.summary.trim(), mentionCount: ids.length, sources };
    })
    .filter((t) => t.mentionCount >= 2)
    .sort((a, b) => b.mentionCount - a.mentionCount);

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
});

export type ArticleDraft = z.infer<typeof ArticleDraftSchema>;

export type BuiltArticle = Pick<
  Article,
  "title" | "whyItMatters" | "paragraphs" | "vocab" | "quiz" | "keyPoints" | "modelSummary" | "sourceMode"
>;

const TYPE_ORDER: Record<QuizType, number> = { blank: 0, synonym: 1, comprehension: 2 };

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

  return {
    title: draft.title.trim(),
    whyItMatters: draft.whyItMatters.trim(),
    paragraphs,
    vocab,
    quiz,
    keyPoints: draft.keyPoints.map((k) => k.trim()).filter(Boolean).slice(0, 5),
    modelSummary: draft.modelSummary.trim(),
  };
}

export async function buildArticle(
  topic: { name: string; summary: string; sources: SourceItem[] },
  grade: GradeLevel,
): Promise<BuiltArticle> {
  if (isDemoGeneration()) {
    await sleep(900);
    const demo = DEMO_TOPICS.find((t) => t.topic === topic.name) ?? DEMO_TOPICS[0];
    return { ...normalizeDraft(demo.draft), sourceMode: "demo" };
  }

  const candidates = topic.sources.filter((s) => isNaverLink(s.url)).slice(0, 6);
  const crawled = (await Promise.all(candidates.map((s) => crawlArticle(s.url))))
    .filter((t): t is string => Boolean(t))
    .slice(0, 3);

  const g = GRADES[grade];
  const fullTexts = crawled.length
    ? crawled.map((text, i) => `<원문 ${i + 1}>\n${text}`).join("\n\n")
    : "(원문을 가져오지 못했다. 아래 제목·요약에 공통으로 나오는 사실만 사용한다.)";
  const snippets = topic.sources.map((s) => `- ${s.title} — ${s.description}`).join("\n");

  const prompt = `[학년군] ${g.label}
[주제] ${topic.name} — ${topic.summary}

[참고 기사 원문]
${fullTexts}

[관련 기사 제목·요약]
${snippets}

위 자료를 바탕으로 ${g.label} 학생이 읽을 시사 기사를 새로 써라.

글쓰기 규칙
- 자료에 있는 사실만 쓴다. 자료에 없는 숫자·이름·날짜·인용을 지어내지 않는다. 자료끼리 내용이 다르면 공통된 내용만 쓴다.
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
modelSummary: ${g.modelSummaryLength} 분량의 모범 요약.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const draft = await generateJson(ArticleDraftSchema, { system: SYSTEM, prompt, temperature: 0.5 });
    const normalized = normalizeDraft(draft);
    if (normalized.quiz.length >= 5 && normalized.paragraphs.length >= 3 && normalized.keyPoints.length >= 2) {
      return { ...normalized, sourceMode: crawled.length ? "crawled" : "snippets" };
    }
  }
  throw new Error("AI가 만든 퀴즈가 형식에 맞지 않아요. 이 기사만 다시 만들어 주세요.");
}

export function emptyArticle(topic: TopicPick): Article {
  return {
    id: newId(),
    topic: topic.name,
    topicSummary: topic.summary,
    mentionCount: topic.mentionCount,
    status: "pending",
    sourceMode: "snippets",
    sources: topic.sources,
    title: "",
    whyItMatters: "",
    paragraphs: [],
    vocab: [],
    quiz: [],
    keyPoints: [],
    modelSummary: "",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
