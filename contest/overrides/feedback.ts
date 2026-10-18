import { HttpError } from "@/lib/http";
import type { Article, GradeLevel, SummaryFeedback } from "@/lib/types";
// @ts-expect-error 원래 모듈 (빌드 스크립트가 진짜 src/lib/feedback.ts로 연결한다)
import { gradeSummary as ruleGrade } from "orig:@/lib/feedback";
import { remoteGrade } from "../app/contest-api";
import { toast } from "../app/toast";
import { withoutAi } from "./env";

/** 학생 요약 채점: 실제 서버의 Claude 채점을 쓰고, 부르지 못하면 원래 앱의 규칙 채점으로 대신한다 */
export async function gradeSummary(
  article: Pick<Article, "title" | "paragraphs" | "keyPoints">,
  grade: GradeLevel,
  text: string,
): Promise<SummaryFeedback> {
  try {
    return await remoteGrade(article, grade, text);
  } catch (error) {
    if (error instanceof HttpError && error.status === 400) throw error;
    toast(`${error instanceof Error ? error.message : "AI 채점을 하지 못했어요."} 이번에는 간단한 규칙으로 채점했어요.`);
    return withoutAi(() => ruleGrade(article, grade, text));
  }
}
