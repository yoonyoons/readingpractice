import type { GradeLevel } from "./types";

export interface GradeProfile {
  level: GradeLevel;
  label: string;
  bodyChars: string;
  paragraphs: string;
  sentence: string;
  vocab: string;
  vocabCount: number;
  tone: string;
  summaryMinChars: number;
  modelSummaryLength: string;
  opinionMinChars: number;
}

export const GRADES: Record<GradeLevel, GradeProfile> = {
  elem34: {
    level: "elem34",
    label: "초등 3~4학년",
    bodyChars: "700~900자",
    paragraphs: "5~6개",
    sentence: "한 문장에 한 가지 내용만 담고, 대부분 25자 안팎의 짧은 문장으로 쓴다",
    vocab:
      "초등 3~4학년 국어·사회 교과서 수준의 쉬운 낱말을 쓴다. 어려운 낱말은 쉬운 말로 바꿔 쓴다. 낱말 뒤에 괄호를 붙여 뜻을 풀어 쓰지 않는다",
    vocabCount: 5,
    tone: "'~해요', '~했어요' 체",
    summaryMinChars: 30,
    modelSummaryLength: "2~3문장(80~120자)",
    opinionMinChars: 20,
  },
  elem56: {
    level: "elem56",
    label: "초등 5~6학년",
    bodyChars: "1000~1300자",
    paragraphs: "6~7개",
    sentence: "대부분 35자 안팎으로 쓰고, 긴 문장은 둘로 나눈다",
    vocab:
      "초등 5~6학년 교과서 수준의 낱말을 쓰되, 시사 이해에 꼭 필요한 한자어·용어는 그대로 쓰고 문맥으로 뜻을 짐작할 수 있게 한다. 낱말 뒤에 괄호를 붙여 뜻을 풀어 쓰지 않는다",
    vocabCount: 6,
    tone: "'~해요', '~했어요' 체",
    summaryMinChars: 50,
    modelSummaryLength: "3~4문장(120~180자)",
    opinionMinChars: 30,
  },
  middle: {
    level: "middle",
    label: "중학생",
    bodyChars: "1300~1700자",
    paragraphs: "6~8개",
    sentence: "대부분 50자 안팎으로 쓰고, 한 문장에 내용을 너무 많이 넣지 않는다",
    vocab:
      "중학교 교과서 수준의 한자어와 시사 용어를 쓰되, 전문 용어는 앞뒤 문장으로 뜻을 짐작할 수 있게 쓴다. 낱말 뒤에 괄호를 붙여 뜻을 풀어 쓰지 않는다",
    vocabCount: 6,
    tone: "'~입니다', '~했습니다' 체",
    summaryMinChars: 80,
    modelSummaryLength: "4~5문장(180~250자)",
    opinionMinChars: 50,
  },
};

export const GRADE_LIST = Object.values(GRADES);

export function isGradeLevel(value: unknown): value is GradeLevel {
  return typeof value === "string" && value in GRADES;
}

/** 초3~4는 스스로 요약문을 쓰는 대신 문단별 키워드 낱말을 찾아 요약 빈칸을 채운다 (lib/keyword-summary.ts) */
export function usesKeywordSummary(grade: GradeLevel) {
  return grade === "elem34";
}

export const MAX_SUMMARY_ATTEMPTS = 3;
export const MAX_SUMMARY_CHARS = 1000;
export const MAX_OPINION_CHARS = 500;

/** 반마다 한 주(서울 월요일 기준)에 나만의 학습지로 만들 수 있는 기사 수 */
export const CUSTOM_ARTICLES_PER_WEEK = 2;

/** 학습지 하나에 넣을 수 있는 기사 수 */
export const MAX_ARTICLES_PER_WORKSHEET = 5;

/** 베타 테스트 기간에는 학습지 편집 화면의 '기사 추가'를 잠근다. 해제하려면 false로 바꾼다 */
export const ADD_ARTICLE_LOCKED = true;
export const ADD_ARTICLE_LOCKED_MESSAGE = "지금은 베타 테스트 기간으로 기사 추가가 어려워요. 추후에 해제될 예정이에요.";
