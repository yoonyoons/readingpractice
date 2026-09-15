"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, CardHeading, ErrorText } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";

export interface WeeklyArticlePreview {
  title: string;
  topic: string;
  sourceCount: number;
  demo: boolean;
}

export function WeeklyArticlesPanel({
  classId,
  gradeLabel,
  weekLabel,
  articles,
  loadedWorksheetId,
  prepareOnLoad,
}: {
  classId: string;
  gradeLabel: string;
  /** "9월 셋째 주" */
  weekLabel: string;
  /** 서버가 이 반 학년군에 맞춰 미리 만들어 둔 이번 주 기사 (완성된 것만) */
  articles: WeeklyArticlePreview[];
  /** 이번 주 기사를 이미 불러온 학습지 */
  loadedWorksheetId: string | null;
  /** 데모 모드: 준비된 기사가 없어도 불러올 때 예시 기사로 바로 만든다 */
  prepareOnLoad: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ready = articles.length > 0;

  async function load() {
    if (loadedWorksheetId && !window.confirm("이번 주 기사를 이미 불러왔어요.\n같은 기사로 초안을 하나 더 만들까요?")) return;
    setLoading(true);
    setError("");
    try {
      const r = await apiFetch<{ worksheetId: string }>(`/api/classes/${classId}/weekly`);
      router.push(`/teacher/classes/${classId}/worksheets/${r.worksheetId}`);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Card className="bg-linear-to-br from-white to-primary-weak">
      <CardHeading
        icon="📰"
        iconClassName="bg-white shadow-[0_2px_10px_rgba(49,130,246,0.14)]"
        eyebrow="바로 쓰는 시사 기사"
        title="이번 주 기사 불러오기"
        badge={<Badge tone="blue">{weekLabel}</Badge>}
      />
      <p className="mt-3 text-[14px] leading-relaxed text-grey-600">
        매주 월요일 아침, 지난 7일 한국·세계 주요 뉴스에서 주제 2개(정치·날씨 제외)를 골라 <b>{gradeLabel}</b> 수준의
        기사·어휘 퀴즈·생각 나누기 질문을 미리 만들어 둬요. 불러오면 바로 초안이 생기고, 배포 전에 미리 보고 고칠 수 있어요.
      </p>

      {ready ? (
        <ol className="mt-4 space-y-2">
          {articles.map((a, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-weak text-[13px] font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-grey-900">{a.title}</p>
                <p className="truncate text-[13px] text-grey-500">
                  {a.topic} · {a.demo ? "예시 기사" : `출처 ${a.sourceCount}곳`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 rounded-2xl bg-white/80 px-4 py-5 text-center">
          <p className="text-[15px] font-semibold text-grey-700">
            {prepareOnLoad ? "예시 기사로 바로 준비할 수 있어요" : "⏳ 이번 주 기사를 준비하고 있어요"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-grey-500">
            {prepareOnLoad
              ? "Brave·Anthropic API 키가 없어 불러올 때 예시 기사로 만들어요 (데모 모드)"
              : "매주 월요일 아침에 준비돼요. 준비가 끝나면 여기에서 바로 불러올 수 있어요."}
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button size="lg" className="w-full sm:w-auto" onClick={load} loading={loading} disabled={!ready && !prepareOnLoad}>
          📥 이번 주 기사 불러오기
        </Button>
        {loadedWorksheetId && (
          <p className="text-center text-[14px] text-grey-600 sm:text-left">
            이미 불러왔어요 ·{" "}
            <Link
              href={`/teacher/classes/${classId}/worksheets/${loadedWorksheetId}`}
              className="font-semibold text-primary hover:underline"
            >
              불러온 학습지 보기
            </Link>
          </p>
        )}
      </div>
      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Card>
  );
}
