"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import type { LibraryField } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface PickerArticle {
  id: string;
  /** 학년군 기사 전체에서의 번호 (처음 기사 다음 자동 기사, 만든 순서) */
  no: number;
  field: LibraryField;
  addedBy: "seed" | "auto";
  keyword: string;
  title: string;
  date: string;
  standards: { code: string; label: string; text: string }[];
  curriculum: string;
  paragraphs: string[];
  source: string;
  sourceNote: string;
  /** 이 기사를 읽기 시작한 이 반 학생 수 */
  readers: number;
}

type FieldInfo = { key: LibraryField; label: string; emoji: string };
type Kind = "all" | "seed" | "auto";
type Status = "all" | "in" | "out";

const KINDS: { key: Kind; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "seed", label: "처음 넣어 둔 기사" },
  { key: "auto", label: "자동 추가 기사" },
];
const STATUSES: { key: Status; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "in", label: "우리 반 목록에 있음" },
  { key: "out", label: "목록에 없음" },
];

/**
 * 반의 관심 분야 기사 목록 만들기: 학년군 기사 전체에서 고르고, 분야마다 순서를 정해 '우리 반에 올리기'로 저장한다.
 * 올리기 전에는 학생 화면이 바뀌지 않는다.
 */
export function LibraryPicker({
  classId,
  fields,
  articles,
  initial,
}: {
  classId: string;
  fields: FieldInfo[];
  articles: PickerArticle[];
  initial: string[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [list, setList] = useState(initial);
  const [field, setField] = useState<LibraryField | "all">("all");
  const [kind, setKind] = useState<Kind>("all");
  const [status, setStatus] = useState<Status>("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
  const inList = useMemo(() => new Set(list), [list]);
  const dirty = list.length !== saved.length || list.some((id, i) => id !== saved[i]);

  // 올리지 않은 변경이 있으면 화면을 떠나기 전에 묻는다
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const shown = articles.filter(
    (a) =>
      (field === "all" || a.field === field) &&
      (kind === "all" || a.addedBy === kind) &&
      (status === "all" || (status === "in") === inList.has(a.id)),
  );
  const shownIn = shown.filter((a) => inList.has(a.id));
  const shownOut = shown.filter((a) => !inList.has(a.id));

  const add = (ids: string[]) => setList((l) => [...l, ...ids.filter((id) => !l.includes(id))]);
  const remove = (ids: string[]) => setList((l) => l.filter((id) => !ids.includes(id)));

  /** 같은 분야 안에서 바로 앞(-1)·뒤(+1) 기사와 자리를 바꾼다 */
  function move(id: string, dir: -1 | 1) {
    setList((l) => {
      const f = byId.get(id)?.field;
      const same = l.filter((x) => byId.get(x)?.field === f);
      const j = same.indexOf(id) + dir;
      if (j < 0 || j >= same.length) return l;
      const next = [...l];
      const a = next.indexOf(id);
      const b = next.indexOf(same[j]);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }

  function removeOne(id: string) {
    const readers = byId.get(id)?.readers ?? 0;
    if (readers > 0 && !window.confirm(`이 기사를 읽기 시작한 학생이 ${readers}명 있어요. 목록에서 뺄까요?\n올리면 그 학생들의 목록에서도 사라지고, 이미 모은 별은 그대로 남아요.`)) return;
    remove([id]);
  }

  function addShown() {
    if (!window.confirm(`지금 보이는 기사 ${shownOut.length}편을 모두 우리 반 목록 끝에 넣을까요?`)) return;
    add(shownOut.map((a) => a.id));
  }

  function removeShown() {
    const readers = shownIn.reduce((n, a) => n + a.readers, 0);
    const note = readers > 0 ? `\n이 중에는 학생이 읽기 시작한 기사도 있어요. 이미 모은 별은 그대로 남아요.` : "";
    if (!window.confirm(`지금 보이는 기사 ${shownIn.length}편을 모두 우리 반 목록에서 뺄까요?${note}`)) return;
    remove(shownIn.map((a) => a.id));
  }

  async function upload() {
    setSaving(true);
    try {
      await apiFetch(`/api/classes/${classId}/library`, { method: "PUT", body: { articleIds: list } });
      setSaved(list);
      router.refresh();
    } catch (err) {
      window.alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const toggleOpen = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chip = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
      active ? "bg-grey-800 text-white" : "bg-white text-grey-600 hover:bg-grey-200",
    );

  return (
    <div className="mt-5">
      {/* 올리기 막대 */}
      <div className="sticky top-16 z-30 -mx-1 mb-5 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] backdrop-blur print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-grey-700">
            우리 반 목록 <b className="text-grey-900">{list.length}편</b>
            {dirty ? (
              <span className="ml-2 font-semibold text-warning">· 아직 학생에게 올리지 않은 변경이 있어요</span>
            ) : (
              <span className="ml-2 text-grey-500">· 학생 화면과 같아요</span>
            )}
          </p>
          <div className="flex gap-2">
            {dirty && (
              <Button variant="grey" size="sm" onClick={() => setList(saved)} disabled={saving}>
                되돌리기
              </Button>
            )}
            <Button size="sm" onClick={upload} loading={saving} disabled={!dirty}>
              ⬆ 우리 반에 올리기
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start print:block">
        <div>
          {/* 거르기 */}
          <div className="space-y-2 print:hidden">
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={chip(field === "all")} onClick={() => setField("all")}>
                모든 분야
              </button>
              {fields.map((f) => (
                <button key={f.key} type="button" className={chip(field === f.key)} onClick={() => setField(f.key)}>
                  {f.emoji} {f.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button key={k.key} type="button" className={chip(kind === k.key)} onClick={() => setKind(k.key)}>
                  {k.label}
                </button>
              ))}
              <span className="mx-1 self-center text-grey-300">|</span>
              {STATUSES.map((s) => (
                <button key={s.key} type="button" className={chip(status === s.key)} onClick={() => setStatus(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[13px] text-grey-500">보이는 기사 {shown.length}편</span>
              <Button variant="secondary" size="sm" onClick={addShown} disabled={shownOut.length === 0}>
                ＋ 모두 목록에 넣기 ({shownOut.length})
              </Button>
              <Button variant="grey" size="sm" onClick={removeShown} disabled={shownIn.length === 0}>
                모두 목록에서 빼기 ({shownIn.length})
              </Button>
            </div>
          </div>

          {shown.length === 0 ? (
            <Card className="mt-4">
              <EmptyState icon="🗂️" title="조건에 맞는 기사가 없어요" description="위에서 분야나 종류를 바꿔 보세요." />
            </Card>
          ) : (
            <div className="mt-4 space-y-4 print:mt-0 print:space-y-0">
              {shown.map((a) => {
                const f = fields.find((x) => x.key === a.field)!;
                const position = list.filter((id) => byId.get(id)?.field === a.field).indexOf(a.id);
                const expanded = open.has(a.id);
                return (
                  <Card key={a.id} className="print:break-before-page print:rounded-none print:p-0 print:first:break-before-auto">
                    <article>
                      <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-grey-500">
                        <span className="font-bold text-primary">{String(a.no).padStart(2, "0")}</span>
                        <Badge tone="blue">
                          {f.emoji} {f.label}
                        </Badge>
                        <Badge tone={a.addedBy === "auto" ? "orange" : "grey"}>{a.addedBy === "auto" ? "자동 추가" : "처음 기사"}</Badge>
                        <span>
                          · 키워드 「{a.keyword}」{a.addedBy === "auto" ? ` · ${a.date} 추가` : ""}
                        </span>
                      </div>
                      <h2 className="mt-2 text-[20px] font-bold leading-snug tracking-tight text-grey-900">{a.title}</h2>

                      <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
                        {position >= 0 ? (
                          <>
                            <Button variant="grey" size="sm" onClick={() => removeOne(a.id)}>
                              목록에서 빼기
                            </Button>
                            <Badge tone="green">
                              ✓ 우리 반 {f.label} {position + 1}번째{a.readers > 0 ? ` · 읽은 학생 ${a.readers}명` : ""}
                            </Badge>
                          </>
                        ) : (
                          <>
                            <Button size="sm" onClick={() => add([a.id])}>
                              ＋ 목록에 넣기
                            </Button>
                            {a.readers > 0 && <span className="text-[13px] text-grey-500">읽은 학생 {a.readers}명</span>}
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleOpen(a.id)}
                          className="ml-auto text-[13px] font-semibold text-grey-500 underline-offset-2 hover:text-grey-800 hover:underline"
                        >
                          {expanded ? "본문 접기 ▲" : "본문·성취기준 보기 ▼"}
                        </button>
                      </div>

                      <div className={cn(expanded ? "block" : "hidden", "print:block")}>
                        <div className="mt-4 rounded-2xl bg-grey-50 px-4 py-3 text-[13px] leading-relaxed print:border print:border-grey-200">
                          <p className="font-bold text-grey-800">관련 성취기준 (2022 개정)</p>
                          {a.standards.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-grey-700">
                              {a.standards.map((s) => (
                                <li key={s.code}>
                                  <b>{s.code}</b> <span className="text-grey-500">{s.label}</span> {s.text}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-grey-700">{a.curriculum || "-"}</p>
                          )}
                        </div>
                        <div className="mt-5 space-y-3 text-[16px] leading-[1.85] text-grey-800 print:text-[11pt]">
                          {a.paragraphs.map((p, j) => (
                            <p key={j}>{p}</p>
                          ))}
                        </div>
                        <p className="mt-5 break-all text-[12px] text-grey-400">
                          출처: {a.source}
                          <br />
                          {a.sourceNote}
                        </p>
                      </div>
                    </article>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 우리 반 목록: 분야마다 순서 정하기 */}
        <Card className="print:hidden lg:sticky lg:top-36 lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto">
          <h2 className="text-[17px] font-bold">우리 반 목록</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-grey-500">
            학생은 분야마다 위에서부터 한 편씩 읽고, 앞 기사에서 별 3개를 모으면 다음 기사가 열려요. 이미 읽기 시작한 기사는 순서를 바꿔도 계속 열려 있어요.
          </p>
          {fields.map((f) => {
            const ids = list.filter((id) => byId.get(id)?.field === f.key);
            return (
              <div key={f.key} className="mt-4">
                <p className="text-[14px] font-bold text-grey-800">
                  {f.emoji} {f.label} <span className="font-medium text-grey-400">{ids.length}편</span>
                </p>
                {ids.length === 0 ? (
                  <p className="mt-1 rounded-xl bg-grey-50 px-3 py-2 text-[13px] text-grey-400">아직 없어요</p>
                ) : (
                  <ol className="mt-1 space-y-1">
                    {ids.map((id, i) => {
                      const a = byId.get(id)!;
                      return (
                        <li key={id} className="flex items-center gap-1.5 rounded-xl bg-grey-50 px-2 py-1.5">
                          <span className="w-5 shrink-0 text-center text-[12px] font-bold text-grey-400">{i + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-grey-800" title={a.title}>
                              {a.keyword}
                            </span>
                            <span className="block truncate text-[11px] text-grey-500">
                              {a.addedBy === "auto" ? "자동 추가" : "처음 기사"} · {a.title}
                            </span>
                          </span>
                          <button
                            type="button"
                            aria-label="위로"
                            disabled={i === 0}
                            onClick={() => move(id, -1)}
                            className="rounded-md px-1.5 py-0.5 text-[13px] text-grey-500 hover:bg-white disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            aria-label="아래로"
                            disabled={i === ids.length - 1}
                            onClick={() => move(id, 1)}
                            className="rounded-md px-1.5 py-0.5 text-[13px] text-grey-500 hover:bg-white disabled:opacity-30"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            aria-label="목록에서 빼기"
                            onClick={() => removeOne(id)}
                            className="rounded-md px-1.5 py-0.5 text-[13px] text-grey-400 hover:bg-white hover:text-danger"
                          >
                            ✕
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
