import Link from "next/link";
import { Badge, ChevronRight } from "@/components/ui";
import type { StudentRecord, Submission, Worksheet } from "@/lib/types";
import { formatDate, isArticleDone } from "@/lib/utils";

/** 반 화면과 학습지 관리 화면에서 쓰는 학습지 한 줄 */
export function WorksheetRow({
  classId,
  worksheet: w,
  students,
  submissions,
}: {
  classId: string;
  worksheet: Worksheet;
  students: StudentRecord[];
  /** 이 학습지의 제출 기록 */
  submissions: Submission[];
}) {
  const ready = w.articles.filter((a) => a.status === "ready");
  // 이 학습지의 기사를 모두 끝낸 학생 수
  const doneStudents = students.filter((student) =>
    ready.every((article) => {
      const sub = submissions.find((s) => s.studentId === student.id && s.articleId === article.id);
      return sub ? isArticleDone(article, sub) : false;
    }),
  ).length;
  return (
    <li>
      <Link
        href={`/teacher/classes/${classId}/worksheets/${w.id}`}
        className="-mx-3 flex items-center gap-3 rounded-2xl px-3 py-3.5 transition hover:bg-grey-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge tone={w.status === "published" ? "green" : "grey"}>{w.status === "published" ? "배포 중" : "초안"}</Badge>
            <span className="truncate text-[16px] font-semibold text-grey-800">{w.title}</span>
          </div>
          <p className="mt-1 truncate text-[13px] text-grey-500">
            {formatDate(w.createdAt)} · {w.articles.map((a) => a.topic).join(" · ")}
          </p>
        </div>
        {w.status === "published" && ready.length > 0 && students.length > 0 && (
          <span className="shrink-0 text-[13px] font-semibold text-primary">
            학습 완료 {doneStudents}/{students.length}명
          </span>
        )}
        <ChevronRight className="size-5 shrink-0 text-grey-300" />
      </Link>
    </li>
  );
}
