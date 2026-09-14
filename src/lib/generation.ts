import { z } from "zod";
import { collectWeeklyNews } from "./brave";
import { generateJson } from "./claude";
import { DEMO_OPINIONS, DEMO_TOPICS } from "./demo-data";
import { isDemoGeneration } from "./env";
import { GRADES } from "./grades";
import { pickTopicsFromNews, type TopicPick } from "./topics";
import type { Article, GradeLevel, QuizItem, QuizType, SourceItem } from "./types";
import { BLANK, clean, newId, shuffle } from "./utils";

export type { TopicPick } from "./topics";

const SYSTEM =
  "너는 대한민국 초등학생·중학생을 위한 시사 교육 콘텐츠 편집자다. 사실에 충실하고, 정치적으로 중립적이며, 학생 눈높이에 맞게 쓴다.";

/** Brave 뉴스 검색으로 지난 7일 기사를 모은 뒤 학습 주제 count개를 고른다. demo면 예시 주제를 쓴다 */
export async function pickTopics(count = 2, demo = isDemoGeneration()): Promise<TopicPick[]> {
  if (demo) {
    await sleep(800);
    return DEMO_TOPICS.slice(0, count).map((t) => ({
      name: t.topic,
      summary: t.topicSummary,
      facts: [],
      mentionCount: t.sources.length,
      sources: t.sources,
      method: "claude" as const,
    }));
  }

  const { items } = await collectWeeklyNews();
  if (items.length < 10) throw new Error("지난 일주일 뉴스를 충분히 모으지 못했어요. 잠시 후 다시 시도해 주세요.");
  return pickTopicsFromNews(items, count);
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

/** AI가 문장에 빈칸을 미리 뚫어 보낸 경우에 쓰는 표시들 */
const BLANK_MARK = /\(\s*\)|_{2,}|□+|\[\s*\]|○○+/;

/**
 * AI가 만든 초안을 검증해 학생에게 내보낼 수 있는 형태로 바꾼다. 형식이 맞지 않는 문항은 버린다.
 * rejects 배열을 넘기면 버려진 문항과 그 까닭을 담아 준다(재시도 프롬프트·로그용).
 */
export function normalizeDraft(draft: ArticleDraft, rejects: string[] = []): Omit<BuiltArticle, "sourceMode"> {
  const paragraphs = draft.paragraphs.map((p) => clean(p)).filter(Boolean);
  const body = paragraphs.join(" ");
  const vocab = draft.vocab
    .map((v) => ({ word: clean(v.word), meaning: clean(v.meaning) }))
    .filter((v) => v.word && v.meaning && body.includes(v.word));

  const quiz: QuizItem[] = [];
  for (const [i, q] of draft.quiz.entries()) {
    const label = `${i + 1}번(${q.type})`;
    const answer = clean(q.answer);
    let choices = [...new Set(q.choices.map((c) => clean(c)).filter(Boolean))];
    if (!answer || !choices.includes(answer)) {
      rejects.push(`${label}: answer '${answer}'가 choices에 그대로 들어 있지 않음`);
      continue;
    }
    if (choices.length < 4) {
      rejects.push(`${label}: 보기가 ${choices.length}개뿐임(서로 다른 4개 필요)`);
      continue;
    }
    // 보기가 4개를 넘으면 정답을 남기고 앞에서부터 3개만 쓴다
    if (choices.length > 4) choices = [answer, ...choices.filter((c) => c !== answer).slice(0, 3)];

    let sentence = clean(q.sentence);
    let prompt = clean(q.prompt);
    let target = "";
    if (q.type === "blank") {
      if (sentence.includes(answer)) sentence = sentence.replace(answer, BLANK);
      else if (BLANK_MARK.test(sentence)) sentence = sentence.replace(BLANK_MARK, BLANK);
      else {
        rejects.push(`${label}: sentence에 정답 '${answer}'가 글자 그대로 들어 있지 않음 — "${sentence.slice(0, 40)}"`);
        continue;
      }
      prompt ||= "빈칸에 들어갈 알맞은 낱말은 무엇인가요?";
    } else if (q.type === "synonym") {
      target = clean(q.target);
      if (!target || !sentence.includes(target)) {
        rejects.push(`${label}: target '${target}'가 sentence에 글자 그대로 들어 있지 않음 — "${sentence.slice(0, 40)}"`);
        continue;
      }
      prompt ||= `'${target}'와(과) 뜻이 가장 비슷한 말은 무엇인가요?`;
    } else {
      sentence = "";
    }
    if (!prompt) {
      rejects.push(`${label}: prompt(질문)가 비어 있음`);
      continue;
    }

    const shuffled = shuffle(choices);
    quiz.push({
      id: newId(),
      type: q.type,
      prompt,
      sentence,
      target,
      choices: shuffled,
      answer: shuffled.indexOf(answer),
      explanation: clean(q.explanation),
    });
  }
  quiz.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);

  const stances = [...new Set(draft.stances.map((s) => clean(s)).filter(Boolean))].slice(0, 3);

  return {
    title: clean(draft.title),
    whyItMatters: clean(draft.whyItMatters),
    paragraphs,
    vocab,
    quiz,
    keyPoints: draft.keyPoints.map((k) => clean(k)).filter(Boolean).slice(0, 5),
    modelSummary: clean(draft.modelSummary),
    opinionQuestion: clean(draft.opinionQuestion),
    stances: stances.length >= 2 ? stances : DEFAULT_STANCES,
  };
}

export async function buildArticle(
  topic: { name: string; summary: string; facts: string[]; sources: SourceItem[] },
  grade: GradeLevel,
  demo = isDemoGeneration(),
): Promise<BuiltArticle> {
  if (demo) {
    await sleep(900);
    const sample = DEMO_TOPICS.find((t) => t.topic === topic.name) ?? DEMO_TOPICS[0];
    return { ...normalizeDraft({ ...sample.draft, ...DEMO_OPINIONS[sample.topic] }), sourceMode: "demo" };
  }

  const g = GRADES[grade];
  const facts = topic.facts.length
    ? topic.facts.map((f) => `- ${f}`).join("\n")
    : `- ${topic.summary} (자세한 사실 정보가 없으니 이 문장의 범위를 벗어나지 않는다)`;
  const sources = topic.sources.map((s) => `- ${s.title} (${s.url})`).join("\n");

  const prompt = `[학년군] ${g.label}
[주제] ${topic.name} — ${topic.summary}

[뉴스 검색으로 확인한 사실·기사 요약]
${facts}

[출처]
${sources}

위 자료를 바탕으로 ${g.label} 학생이 읽을 시사 기사를 새로 써라. 출처 기사의 문장을 그대로 옮기지 말고 새로 쓴다.

글쓰기 규칙
- HTML 태그나 마크다운 기호(**, __, <b> 등)를 쓰지 않고 순수한 글로만 쓴다.
- 위 자료에 있는 내용만 쓴다. 자료에 없는 숫자·이름·날짜·인용을 지어내지 않는다. 자료끼리 내용이 다르면 공통된 내용만 쓴다.
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

  let retryNote = "";
  let lastRejects: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const rejects: string[] = [];
    const normalized = normalizeDraft(
      await generateJson(ArticleDraftSchema, { system: SYSTEM, prompt: prompt + retryNote }),
      rejects,
    );
    if (normalized.quiz.length >= 5 && normalized.paragraphs.length >= 3 && normalized.keyPoints.length >= 2) {
      if (rejects.length) console.warn(`[buildArticle] '${topic.name}' 버려진 문항:`, rejects);
      return { ...normalized, sourceMode: "web" };
    }
    lastRejects = rejects;
    console.warn(`[buildArticle] '${topic.name}' ${attempt + 1}번째 시도 형식 불합격`, {
      quiz: normalized.quiz.length,
      paragraphs: normalized.paragraphs.length,
      keyPoints: normalized.keyPoints.length,
      rejects,
    });
    // 두 번째 시도에는 무엇이 잘못됐는지 알려 주어 같은 실수를 되풀이하지 않게 한다
    retryNote = `

[이전 시도에서 형식에 맞지 않아 버려진 문항]
${rejects.length ? rejects.map((r) => `- ${r}`).join("\n") : "- (문단 또는 keyPoints 수가 부족했음)"}
위 문제를 고쳐 다시 작성하라. blank·synonym 문항의 sentence는 본문 문장을 한 글자도 바꾸지 말고 그대로 옮기고, answer와 target은 그 문장 안에 실제로 있는 글자 그대로(조사를 붙이지 말고) 써라. 보기는 서로 다른 4개여야 한다.`;
  }
  const why = lastRejects.slice(0, 2).join(" / ");
  throw new Error(`AI가 만든 퀴즈가 형식에 맞지 않아요${why ? ` (${why})` : ""}. 이 기사만 다시 만들어 주세요.`);
}

/** 기사들을 동시에 만들고, 하나가 끝날 때마다 onProgress를 부른다. 실패한 기사는 failed 상태로 남긴다. */
export async function buildAllArticles(
  articles: Article[],
  grade: GradeLevel,
  onProgress?: (index: number, article: Article) => void,
  demo = isDemoGeneration(),
): Promise<Article[]> {
  const result = [...articles];
  await Promise.all(
    articles.map(async (article, index) => {
      try {
        const built = await buildArticle(
          { name: article.topic, summary: article.topicSummary, facts: article.facts ?? [], sources: article.sources },
          grade,
          demo,
        );
        // 붙여넣은 기사로 만든 기사는 다시 만들어도 출처 종류(url)를 유지한다
        const sourceMode = article.sourceMode === "url" && built.sourceMode === "web" ? "url" : built.sourceMode;
        result[index] = { ...article, ...built, sourceMode, status: "ready", error: undefined };
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
