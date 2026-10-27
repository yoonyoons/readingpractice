import { z } from "zod";
import { generateJson } from "./claude";
import { getDb } from "./db";
import { LIBRARY_WORKSHEET_ID } from "./db/repo";
import { hasAnthropic } from "./env";
import { GRADES, usesKeywordSummary } from "./grades";
import type {
  Article,
  GradeLevel,
  KeywordPiece,
  KeywordSummary,
  LibraryArticle,
  PublicKeywordSummary,
  SummaryFeedback,
  Worksheet,
} from "./types";
import { clean, stripGlosses } from "./utils";

/*
 * 초3~4 요약하기: 스스로 요약문을 쓰는 대신, 문단마다 중심 문장의 키워드 낱말을 찾아 쓰고
 * 그 낱말로 글 전체 요약의 빈칸을 채운다. 문장 속 [[낱말]]이 빈칸이다.
 */
export { usesKeywordSummary };

/** 빈칸을 처음 또는 두 번째에 맞혀야 점수에 넣는다 (두 번 틀리면 첫 글자 힌트, 세 번 틀리면 정답을 보여 준다) */
export const CREDITED_TRIES = 2;
export const HINT_AFTER = 2;
export const REVEAL_AFTER = 3;

const MARK = /\[\[([^\]]+)\]\]/g;

type Piece = string | { id: string; answer: string };

function parse(text: string, prefix: string): Piece[] {
  const pieces: Piece[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(MARK)) {
    if (m.index > last) pieces.push(text.slice(last, m.index));
    pieces.push({ id: `${prefix}${n++}`, answer: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) pieces.push(text.slice(last));
  return pieces;
}

function parseAll(ks: KeywordSummary) {
  return {
    paragraphs: ks.paragraphs.map((p, i) => parse(p, `p${i}-`)),
    summary: parse(ks.summary, "s"),
  };
}

const isBlank = (p: Piece): p is { id: string; answer: string } => typeof p !== "string";

/** 빈칸 id → 정답. 문단 빈칸은 p{문단}-{번호}, 전체 요약 빈칸은 s{번호} */
export function keywordAnswers(ks: KeywordSummary) {
  const parsed = parseAll(ks);
  const answers = new Map<string, string>();
  for (const piece of [...parsed.paragraphs.flat(), ...parsed.summary]) if (isBlank(piece)) answers.set(piece.id, piece.answer);
  return answers;
}

export function toPublicKeywordSummary(ks: KeywordSummary): PublicKeywordSummary {
  const hide = (pieces: Piece[]): KeywordPiece[] =>
    pieces.map((p) => (isBlank(p) ? { id: p.id, lengths: p.answer.split(/\s+/).map((w) => [...w].length) } : p));
  const parsed = parseAll(ks);
  return { paragraphs: parsed.paragraphs.map(hide), summary: hide(parsed.summary) };
}

/** 띄어쓰기는 보지 않고 낱말만 맞는지 본다 */
export function sameWord(a: string, b: string) {
  const norm = (s: string) => s.replace(/\s+/g, "").normalize("NFC");
  return norm(a) === norm(b);
}

/** 빈칸 하나를 확인한다. tries는 이번 시도를 포함한 횟수 */
export function checkBlank(answer: string, value: string, tries: number) {
  if (sameWord(answer, value)) return { correct: true as const };
  return {
    correct: false as const,
    hint: tries >= HINT_AFTER ? [...answer][0] : undefined,
    answer: tries >= REVEAL_AFTER ? answer : undefined,
  };
}

export type BlankRecord = { value: string; tries: number };

/** 모든 빈칸을 채운 기록으로 점수와 피드백, 완성된 요약 글을 만든다. 빠진 빈칸이 있으면 null */
export function gradeKeywordSummary(ks: KeywordSummary, blanks: Record<string, BlankRecord>) {
  const parsed = parseAll(ks);
  const credited = (id: string, answer: string) => {
    const b = blanks[id];
    return Boolean(b && sameWord(answer, b.value) && b.tries >= 1 && b.tries <= CREDITED_TRIES);
  };
  const filled = (id: string, answer: string) => {
    const b = blanks[id];
    return Boolean(b && sameWord(answer, b.value));
  };

  const paraBlanks = parsed.paragraphs.flatMap((pieces, index) => pieces.filter(isBlank).map((b) => ({ ...b, index })));
  const sumBlanks = parsed.summary.filter(isBlank);
  if (![...paraBlanks, ...sumBlanks].every((b) => filled(b.id, b.answer))) return null;

  const paraOk = paraBlanks.filter((b) => credited(b.id, b.answer));
  const sumOk = sumBlanks.filter((b) => credited(b.id, b.answer));
  const rate = (ok: number, total: number) => (total ? ok / total : 1);
  const paraRate = rate(paraOk.length, paraBlanks.length);
  const sumRate = rate(sumOk.length, sumBlanks.length);
  const allRate = rate(paraOk.length + sumOk.length, paraBlanks.length + sumBlanks.length);
  const breakdown = {
    content: Math.round(50 * paraRate),
    ownWords: Math.round(30 * sumRate),
    sentence: Math.round(20 * allRate),
  };

  const missedPara = paraBlanks.filter((b) => !credited(b.id, b.answer));
  const missedSum = sumBlanks.filter((b) => !credited(b.id, b.answer));
  const missedWords = [
    ...missedPara.map((b) => `'${b.answer}'(${b.index + 1}문단)`),
    ...missedSum.filter((b) => !missedPara.some((p) => sameWord(p.answer, b.answer))).map((b) => `'${b.answer}'`),
  ];

  const feedback: SummaryFeedback = {
    score: breakdown.content + breakdown.ownWords + breakdown.sentence,
    breakdown,
    strengths:
      paraOk.length > 0
        ? `${paraBlanks.length}개 문단 가운데 ${paraOk.length}개 문단의 중심 낱말을 스스로 찾았어요.`
        : "끝까지 포기하지 않고 문단마다 중심 낱말을 찾아 요약을 완성했어요.",
    missing: missedWords.length
      ? `${missedWords.slice(0, 3).join(", ")} 같은 낱말은 기사에서 한 번 더 찾아보세요.`
      : "모든 빈칸을 스스로 맞혔어요. 문단마다 중심 낱말을 정말 잘 찾았어요.",
    advice: "문단을 읽을 때 '이 문단은 무엇에 대한 이야기일까?'를 생각하며 자주 나오는 낱말을 찾아보세요.",
    keyword: {
      paragraphs: [paraOk.length, paraBlanks.length],
      summary: [sumOk.length, sumBlanks.length],
      words: [...new Set([...paraBlanks, ...sumBlanks].map((b) => b.answer))],
    },
  };
  const text = parsed.summary.map((p) => (isBlank(p) ? p.answer : p)).join("");
  return { feedback, text };
}

/* ───────────── 자료 만들기 ───────────── */

/** 문단 수가 맞고, 정답 낱말이 모두 본문에 있고, 전체 요약에 빈칸이 하나 이상 있어야 쓸 수 있다 */
export function isValidKeywordSummary(ks: KeywordSummary | undefined, article: Pick<Article, "paragraphs">): ks is KeywordSummary {
  if (!ks || ks.paragraphs.length !== article.paragraphs.length) return false;
  const body = article.paragraphs.map(stripGlosses).join(" ").replace(/\s+/g, "");
  const answers = [...keywordAnswers(ks).values()];
  if (!answers.length || !answers.every((a) => a && [...a].length <= 12 && body.includes(a.replace(/\s+/g, "")))) return false;
  if (!parse(ks.summary, "s").some(isBlank)) return false;
  return ks.paragraphs.every((p) => [...p.matchAll(MARK)].length <= 1);
}

const DraftSchema = z.object({
  paragraphs: z.array(z.string()),
  summary: z.string(),
});

const SYSTEM =
  "너는 초등학교 3~4학년 국어 선생님이다. 학생이 기사를 읽고 문단별 중심 내용과 글 전체의 중심 내용을 정리하도록 돕는 '키워드 낱말 빈칸' 활동지를 만든다.";

async function generateWithAi(article: Article, grade: GradeLevel): Promise<KeywordSummary> {
  const g = GRADES[grade];
  const paragraphs = article.paragraphs.map(stripGlosses);
  const prompt = `[학년군] ${g.label}
[기사 제목] ${article.title}
[기사 본문] (문단 ${paragraphs.length}개)
${paragraphs.map((p, i) => `${i + 1}문단: ${p}`).join("\n")}

[모범 요약]
${stripGlosses(article.modelSummary)}

국어 교과서의 '핵심 내용 정리' 활동처럼 만들어라.

paragraphs: 문단마다 그 문단의 중심 내용을 담은 문장 하나 (모두 ${paragraphs.length}개, 순서대로)
- 15~35자의 짧은 문장. 문체는 '~다'로 끝나는 평서문(예: "산호는 바닷속 바위에 붙어서 사는 [[동물]]이다.").
- 그 문단에서 가장 중요한 낱말(키워드) 하나를 [[ ]]로 감싼다. 이 낱말이 학생이 찾아 쓸 빈칸이다.
- 키워드는 본문에 쓰인 글자 그대로 쓰고, 조사를 붙이지 않는다(나쁜 예: [[동물이]]). 2~5글자의 명사가 좋다.
- 문장의 나머지 부분만 읽어도 어느 문단의 이야기인지 알 수 있어야 하고, 본문을 읽어야 빈칸 낱말을 알 수 있어야 한다.
- '것', '때', '사람', '우리'처럼 너무 흔한 낱말은 키워드로 고르지 않는다. 문단마다 서로 다른 낱말을 고른다.
- 글을 여는 질문 문단처럼 중요한 낱말이 없는 문단만 [[ ]] 없이 문장으로 쓴다.

summary: 글 전체의 중심 내용을 2~3문장(80~140자)으로 요약한 글
- 문단 키워드를 이어서 글 전체 내용을 정리한다. 모범 요약을 참고한다.
- 빈칸 [[ ]] 3~5개. 절반 이상은 위 문단 키워드이고, 나머지는 본문에 나온 다른 중요한 낱말이다.
- 빈칸 낱말도 본문에 쓰인 글자 그대로, 조사 없이 쓴다.
- 문체는 '~다'로 끝나는 평서문.`;

  const r = await generateJson(DraftSchema, {
    model: "claude-haiku-4-5-20251001",
    system: SYSTEM,
    prompt,
  });
  const ks: KeywordSummary = {
    paragraphs: r.paragraphs.map((p) => clean(p)),
    summary: clean(r.summary),
  };
  if (!isValidKeywordSummary(ks, article)) throw new Error("키워드 요약 자료가 형식에 맞지 않아요.");
  return ks;
}

/** AI를 쓸 수 없을 때: 문단마다 핵심 어휘가 든 문장에서 그 낱말을 빈칸으로, 모범 요약에서 키워드를 빈칸으로 만든다 */
export function fallbackKeywordSummary(article: Pick<Article, "paragraphs" | "vocab" | "modelSummary" | "topic">): KeywordSummary {
  const body = article.paragraphs.map(stripGlosses).join(" ");
  const words = [...article.vocab.map((v) => v.word), article.topic]
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && w.length <= 8 && body.includes(w));
  const used = new Set<string>();
  const sentences = (text: string) => text.split(/(?<=[.?!])\s+/).filter(Boolean);

  const paragraphs = article.paragraphs.map(stripGlosses).map((p) => {
    const list = sentences(p);
    const word = words.find((w) => !used.has(w) && p.includes(w)) ?? words.find((w) => p.includes(w));
    if (!word) return list[0] ?? p;
    used.add(word);
    const sentence = list.find((s) => s.includes(word)) ?? p;
    return sentence.replace(word, `[[${word}]]`);
  });

  let summary = stripGlosses(article.modelSummary);
  let count = 0;
  for (const w of [...used, ...words]) {
    if (count >= 4) break;
    if (summary.includes(`[[${w}`) || !summary.includes(w) || /\[\[[^\]]*$/.test(summary.slice(0, summary.indexOf(w)))) continue;
    summary = summary.replace(w, `[[${w}]]`);
    count++;
  }
  // 모범 요약에 들어간 키워드가 하나도 없으면 문단 중심 문장을 이어 요약으로 쓴다
  if (count === 0) summary = paragraphs.filter((p) => p.includes("[[")).slice(0, 4).join(" ");
  return { paragraphs, summary };
}

export async function generateKeywordSummary(article: Article, grade: GradeLevel): Promise<KeywordSummary> {
  if (hasAnthropic()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await generateWithAi(article, grade);
      } catch (error) {
        console.warn(`[keywordSummary] '${article.title}' ${attempt + 1}번째 시도 실패`, error);
      }
    }
  }
  return fallbackKeywordSummary(article);
}

/** 같은 기사를 반 학생들이 한꺼번에 열어도 한 번만 만든다 (서버 한 대 안에서) */
const inflight = new Map<string, Promise<KeywordSummary>>();

/**
 * 기사에 키워드 요약 자료가 없으면 만들어 학습지(또는 관심 분야 기사)에 저장하고 돌려준다.
 */
export async function ensureKeywordSummary(worksheet: Worksheet, article: Article, grade: GradeLevel): Promise<KeywordSummary> {
  if (isValidKeywordSummary(article.keywordSummary, article)) return article.keywordSummary;
  const key = `${worksheet.id}:${article.id}`;
  let job = inflight.get(key);
  if (!job) {
    job = (async () => {
      const ks = await generateKeywordSummary(article, grade);
      await save(worksheet, article, ks).catch((e) => console.error("키워드 요약 자료를 저장하지 못했어요", e));
      return ks;
    })().finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  return job;
}

async function save(worksheet: Worksheet, article: Article, ks: KeywordSummary) {
  const db = getDb();
  if (worksheet.id === LIBRARY_WORKSHEET_ID) {
    const library = article as LibraryArticle;
    // 코드에 넣어 둔 기사는 자료를 함께 적어 두므로 자동으로 추가된 기사만 저장한다
    if (library.addedBy === "auto") await db.saveLibraryArticle({ ...library, keywordSummary: ks });
    return;
  }
  // 그 사이 교사가 고쳤을 수 있으므로 최신 학습지에서 같은 본문인 기사만 바꾼다
  const latest = await db.getWorksheet(worksheet.id);
  if (!latest) return;
  const same = (a: Article) => a.id === article.id && a.paragraphs.join("\n") === article.paragraphs.join("\n");
  if (!latest.articles.some(same)) return;
  await db.updateWorksheet(worksheet.id, {
    articles: latest.articles.map((a) => (same(a) ? { ...a, keywordSummary: ks } : a)),
  });
}
