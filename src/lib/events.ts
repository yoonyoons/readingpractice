/** 학습지 생성 API가 한 줄씩(NDJSON) 보내는 진행 상황 */
export type GenerationEvent =
  | { type: "stage"; stage: "collect" }
  | { type: "topics"; worksheetId: string; topics: { name: string; mentionCount: number }[] }
  | { type: "article"; index: number; status: "ready" | "failed"; title?: string; error?: string }
  | { type: "done"; worksheetId: string }
  | { type: "error"; message: string };
