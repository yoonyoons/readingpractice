"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Field, Input, Modal } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client-api";
import { SHOP_EMOJIS } from "@/lib/shop-rules";
import type { ShopItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = { emoji: string; name: string; description: string; price: string; stock: string; perStudentLimit: string };

const EMPTY: Draft = { emoji: SHOP_EMOJIS[0], name: "", description: "", price: "5", stock: "", perStudentLimit: "" };

const toDraft = (item: ShopItem): Draft => ({
  emoji: item.emoji,
  name: item.name,
  description: item.description,
  price: String(item.price),
  stock: item.stock === null ? "" : String(item.stock),
  perStudentLimit: item.perStudentLimit === null ? "" : String(item.perStudentLimit),
});

/** 빈칸이면 제한 없음(null) */
const optionalNumber = (value: string) => (value.trim() === "" ? null : Number(value));

/** 선생님 별 상점: 상품 목록과 등록·수정·삭제 */
export function ShopManager({ classId, items, soldCount }: { classId: string; items: ShopItem[]; soldCount: Record<string, number> }) {
  const router = useRouter();
  // null: 닫힘, "new": 새 상품, 그 밖에는 고치는 상품 id
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  function open(item?: ShopItem) {
    setDraft(item ? toDraft(item) : EMPTY);
    setEditing(item ? item.id : "new");
    setError("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        emoji: draft.emoji,
        name: draft.name,
        description: draft.description,
        price: Number(draft.price),
        stock: optionalNumber(draft.stock),
        perStudentLimit: optionalNumber(draft.perStudentLimit),
      };
      if (editing === "new") await apiFetch(`/api/classes/${classId}/shop`, { body });
      else await apiFetch(`/api/classes/${classId}/shop/${editing}`, { method: "PATCH", body });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ShopItem) {
    if (!window.confirm(`'${item.name}' 상품을 지울까요?\n학생들이 이미 교환한 기록은 남아요.`)) return;
    setDeleting(item.id);
    try {
      await apiFetch(`/api/classes/${classId}/shop/${item.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      window.alert(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  }

  const set = (key: keyof Draft) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold">상품</h2>
          <p className="mt-0.5 text-[13px] text-grey-500">학생이 누르면 바로 별이 빠지고 교환 기록에 남아요.</p>
        </div>
        <Button size="sm" onClick={() => open()}>
          ＋ 상품 등록
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-grey-50 px-4 py-8 text-center text-[14px] text-grey-500">
          아직 등록한 상품이 없어요. &lsquo;상품 등록&rsquo;으로 첫 상품을 올려 보세요.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-grey-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-grey-50 text-[26px]" aria-hidden>
                {item.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold text-grey-800">
                  {item.name} <span className="ml-1 text-[14px] font-bold text-grey-900"><span className="text-[#f5b301]">★</span>{item.price}</span>
                </p>
                <p className="mt-0.5 truncate text-[13px] text-grey-500">
                  {item.stock === null ? "수량 제한 없음" : item.stock === 0 ? "품절" : `남은 수량 ${item.stock}개`}
                  {item.perStudentLimit !== null && ` · 1인당 ${item.perStudentLimit}개`}
                  {` · 교환 ${soldCount[item.id] ?? 0}번`}
                  {item.description && ` · ${item.description}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="grey" onClick={() => open(item)}>
                  수정
                </Button>
                <Button size="sm" variant="ghost" className="text-grey-400 hover:text-danger" loading={deleting === item.id} onClick={() => remove(item)}>
                  삭제
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "상품 등록" : "상품 수정"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <span className="mb-2 block text-[14px] font-medium text-grey-700">그림</span>
            <div className="grid grid-cols-8 gap-1.5">
              {SHOP_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, emoji }))}
                  aria-pressed={draft.emoji === emoji}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl text-[22px] transition",
                    draft.emoji === emoji ? "bg-primary-weak ring-2 ring-primary" : "bg-grey-50 hover:bg-grey-100",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <Field label="상품 이름">
            <Input compact value={draft.name} onChange={set("name")} maxLength={30} placeholder="예: 사탕 1개" required />
          </Field>
          <Field label="설명 (선택)">
            <Input compact value={draft.description} onChange={set("description")} maxLength={80} placeholder="예: 쉬는 시간에 선생님께 받아 가요" />
          </Field>
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="가격 (별)">
              <Input compact type="number" inputMode="numeric" min={1} max={999} value={draft.price} onChange={set("price")} required />
            </Field>
            <Field label="수량">
              <Input compact type="number" inputMode="numeric" min={0} max={999} value={draft.stock} onChange={set("stock")} placeholder="제한 없음" />
            </Field>
            <Field label="1인당 최대">
              <Input compact type="number" inputMode="numeric" min={1} max={99} value={draft.perStudentLimit} onChange={set("perStudentLimit")} placeholder="제한 없음" />
            </Field>
          </div>
          <p className="text-[12px] text-grey-500">수량·1인당 최대를 비워 두면 제한 없이 교환할 수 있어요. 수량은 교환될 때마다 하나씩 줄어요.</p>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit" className="w-full" loading={saving}>
            {editing === "new" ? "등록하기" : "저장하기"}
          </Button>
        </form>
      </Modal>
    </Card>
  );
}
