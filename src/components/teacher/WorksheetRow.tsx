import type { StudentRecord, Submission, Worksheet } from "@/lib/types";
import { isArticleDone } from "@/lib/utils";

/** 학습지 목록 한 줄에 필요한 내용만 추린 것 (브라우저로 학생 정보·기사 본문을 보내지 않는다) */
export interface WorksheetRowData {
  id: string;
  title: string;
  status: Worksheet["status"];
  createdAt: string;
  topics: string[];
  /** 배포한 학습지의 기사를 모두 끝낸 학생 수 (배포 전이거나 학생·기사가 없으면 null) */
  progress: { done: number; total: number } | null;
}

/** 반 화면과 학습지 관리 화면에서 쓰는 학습지 한 줄의 내용 */
export function toWorksheetRow(w: Worksheet, students: StudentRecord[], submissions: Submission[]): WorksheetRowData {
  const ready = w.articles.filter((a) => a.status === "ready");
  // 이 학습지의 기사를 모두 끝낸 학생 수
  const done = students.filter((student) =>
    ready.every((article) => {
      const sub = submissions.find((s) => s.studentId === student.id && s.articleId === article.id);
      return sub ? isArticleDone(article, sub) : false;
    }),
  ).length;
  return {
    id: w.id,
    title: w.title,
    status: w.status,
    createdAt: w.createdAt,
    topics: w.articles.map((a) => a.topic),
    progress: w.status !== "draft" && ready.length > 0 && students.length > 0 ? { done, total: students.length } : null,
  };
}
