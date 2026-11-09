import type { GradeLevel } from "./types";

/**
 * 관심 분야 학습 '경제' 기사의 키워드와 글 짜임.
 * 선생님이 준 초등 참고 자료(한국은행 『초등학생을 위한 알기 쉬운 경제이야기』 10마당)의 차례에서 개념 낱말과
 * 꼭지마다 되풀이되는 글의 짜임만 가져왔다. 참고 자료의 문장·예시·등장인물은 쓰지 않는다.
 * 처음 기사(library-seed-economy.ts)와 매주 자동 기사(library-job.ts) 모두 이 짜임으로 쓴다.
 */

/** 참고 자료 마당 순서대로 묶은 경제 개념 낱말 */
export const ECONOMY_KEYWORDS: { theme: string; words: string[] }[] = [
  { theme: "합리적인 경제인", words: ["희소성", "선택", "기회비용"] },
  { theme: "생산", words: ["재화와 서비스", "생산요소", "생산성", "자본"] },
  { theme: "일과 협력", words: ["인적자본", "분업", "상호 의존", "특화"] },
  { theme: "저축과 은행", words: ["저축", "이자", "예금", "은행", "중앙은행"] },
  { theme: "투자", words: ["투자", "주식", "위험"] },
  { theme: "소비", words: ["소비 계획", "예산", "용돈 기입장", "합리적 소비", "광고", "신용", "신용카드"] },
  { theme: "거래와 돈", words: ["물물교환", "화폐", "지폐"] },
  { theme: "시장과 가격", words: ["시장", "가격", "수요와 공급", "할인", "경쟁"] },
  { theme: "국제 거래", words: ["무역", "수출과 수입", "국산품", "환율"] },
  { theme: "나라 경제", words: ["세금", "물가", "인플레이션", "실업"] },
];

export const ECONOMY_KEYWORD_LIST = ECONOMY_KEYWORDS.flatMap((k) => k.words);

/** 참고 자료 꼭지마다 되풀이되는 글의 짜임 (기사 쓰기 규칙으로 그대로 넣는다) */
export const ECONOMY_STRUCTURE = `- 이 글은 소식을 전하는 기사가 아니라 경제 개념 하나를 풀어 주는 설명하는 글이다. 아래 짜임으로 쓴다.
  1) title은 학생이 품을 만한 궁금증을 묻는 질문형으로 쓴다. 예) "왜 ~할까요?"
  2) 첫 문단: 학생 또래가 집·학교·가게에서 겪을 만한 생활 장면으로 시작하고, 그 장면에서 생긴 궁금증이나 문제를 드러낸다. 실존 인물이나 다른 교재의 등장인물을 쓰지 않는다.
  3) 둘째 문단: "왜 그럴까요?"처럼 묻고, 그 장면을 풀어 주는 경제 개념의 이름과 뜻을 알려 준다. ("이처럼 ~을 ○○이라고 해요" 꼴)
  4) 이어서 개념이 드러나는 주변 사례(가게, 공장, 은행, 시장 등)를 들어 뜻을 넓힌다.
  5) 흔한 오해를 바로잡거나 조심할 점·단점을 한 문단으로 쓴다. ("그렇지 않아요", "하지만 ~에도 조심할 점이 있어요" 꼴)
  6) 나와 가족에서 기업·나라로 시야를 넓혀, 이 개념이 사회 전체에서 어떤 뜻을 갖는지 쓴다.
  7) 마지막 문단: 학생이 오늘부터 해 볼 수 있는 실천이나 생각할 거리로 마무리한다.
- 위 자료에 있는 사실만 쓰고, 생활 장면의 예시는 자료의 문장을 옮기지 말고 새로 만든다.`;

/** 학년군별 문해력 기준 (grades.ts의 분량·문장 규칙을 숫자로 옮긴 것) */
const LITERACY: Record<GradeLevel, { chars: [number, number]; paragraphs: [number, number]; sentence: number }> = {
  elem34: { chars: [700, 900], paragraphs: [5, 6], sentence: 25 },
  elem56: { chars: [1000, 1300], paragraphs: [6, 7], sentence: 35 },
  middle: { chars: [1300, 1700], paragraphs: [6, 8], sentence: 50 },
};

/** 분량은 기준에서 15%까지, 문장 길이는 평균이 기준의 1.25배까지 봐준다 */
const CHAR_SLACK = 0.15;
const SENTENCE_SLACK = 1.25;

export interface ReadabilityReport {
  chars: number;
  paragraphs: number;
  sentences: number;
  avgSentence: number;
  /** 기준 문장 길이의 2배를 넘는 문장 수 */
  longSentences: number;
  problems: string[];
}

const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** 본문이 학년군 문해력 기준(분량·문단 수·문장 길이)에 맞는지 잰다 */
export function checkReadability(paragraphs: string[], grade: GradeLevel): ReadabilityReport {
  const rule = LITERACY[grade];
  const body = paragraphs.join(" ");
  // 공백을 포함한 글자 수 (grades.ts의 분량 기준과 같은 방식)
  const chars = body.length;
  const sentences = paragraphs.flatMap(sentencesOf);
  const lengths = sentences.map((s) => s.length);
  const avgSentence = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0;
  const longSentences = lengths.filter((n) => n > rule.sentence * 2).length;

  const problems: string[] = [];
  const [minChars, maxChars] = rule.chars;
  if (chars < minChars * (1 - CHAR_SLACK)) problems.push(`본문이 짧아요(${chars}자, 기준 ${minChars}~${maxChars}자)`);
  if (chars > maxChars * (1 + CHAR_SLACK)) problems.push(`본문이 길어요(${chars}자, 기준 ${minChars}~${maxChars}자)`);
  const [minP, maxP] = rule.paragraphs;
  if (paragraphs.length < minP - 1 || paragraphs.length > maxP + 1) problems.push(`문단 수가 맞지 않아요(${paragraphs.length}개, 기준 ${minP}~${maxP}개)`);
  if (avgSentence > rule.sentence * SENTENCE_SLACK) problems.push(`문장이 길어요(평균 ${avgSentence}자, 기준 ${rule.sentence}자 안팎)`);
  if (longSentences > Math.max(1, Math.floor(sentences.length * 0.1))) problems.push(`아주 긴 문장이 ${longSentences}개 있어요(${rule.sentence * 2}자 넘음)`);
  return { chars, paragraphs: paragraphs.length, sentences: sentences.length, avgSentence, longSentences, problems };
}
