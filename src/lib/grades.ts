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
}

export const GRADES: Record<GradeLevel, GradeProfile> = {
  elem34: {
    level: "elem34",
    label: "초등 3~4학년",
    bodyChars: "700~900자",
    paragraphs: "5~6개",
    sentence: "한 문장에 한 가지 내용만 담고, 대부분 25자 안팎의 짧은 문장으로 쓴다",
    vocab:
      "초등 3~4학년 국어·사회 교과서 수준의 쉬운 낱말을 쓴다. 꼭 필요한 어려운 낱말은 바로 뒤 괄호에 쉬운 말로 풀어 준다(예: 물가(물건의 값))",
    vocabCount: 5,
    tone: "'~해요', '~했어요' 체",
    summaryMinChars: 30,
    modelSummaryLength: "2~3문장(80~120자)",
  },
  elem56: {
    level: "elem56",
    label: "초등 5~6학년",
    bodyChars: "1000~1300자",
    paragraphs: "6~7개",
    sentence: "대부분 35자 안팎으로 쓰고, 긴 문장은 둘로 나눈다",
    vocab:
      "초등 5~6학년 교과서 수준의 낱말을 쓰되, 시사 이해에 꼭 필요한 한자어·용어는 그대로 쓰고 문맥으로 뜻을 짐작할 수 있게 한다",
    vocabCount: 6,
    tone: "'~해요', '~했어요' 체",
    summaryMinChars: 50,
    modelSummaryLength: "3~4문장(120~180자)",
  },
  middle: {
    level: "middle",
    label: "중학생",
    bodyChars: "1300~1700자",
    paragraphs: "6~8개",
    sentence: "대부분 50자 안팎으로 쓰고, 한 문장에 내용을 너무 많이 넣지 않는다",
    vocab:
      "중학교 교과서 수준의 한자어와 시사 용어를 쓰되, 전문 용어는 처음 나올 때 짧게 설명한다",
    vocabCount: 6,
    tone: "'~입니다', '~했습니다' 체",
    summaryMinChars: 80,
    modelSummaryLength: "4~5문장(180~250자)",
  },
};

export const GRADE_LIST = Object.values(GRADES);

export function isGradeLevel(value: unknown): value is GradeLevel {
  return typeof value === "string" && value in GRADES;
}

export const MAX_SUMMARY_ATTEMPTS = 3;
export const MAX_SUMMARY_CHARS = 1000;
