export async function apiFetch<T = { ok: true }>(
  url: string,
  options: { method?: "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? "POST",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? "요청을 처리하지 못했어요.");
  }
  return data as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
}
