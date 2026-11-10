/**
 * 새로 쓴 글이 원문 문장을 그대로 옮겼는지 잰다 (저작권: 사실·개념이 아니라 원문 표현을 옮기지 않기 위해).
 * 띄어쓰기·문장 부호를 빼고 글자만 비교한다.
 */

/** 이 글자 수 이상 원문과 똑같이 이어지는 구절이 있으면 옮겨 쓴 것으로 본다 */
export const MAX_SHARED_RUN = 20;

const letters = (text: string) => text.replace(/[\s.,·…!?'"“”‘’()\[\]{}:;~\-–—]/g, "");

export interface OverlapReport {
  /** 원문과 똑같이 이어지는 가장 긴 구절(글자 수) */
  longestRun: number;
  /** MAX_SHARED_RUN 글자 이상 겹치는 구절 (원문 그대로의 모양) */
  copied: string[];
}

/** 새로 쓴 글(paragraphs)과 원문(source)이 똑같이 이어지는 구절을 찾는다 */
export function findOverlap(paragraphs: string[], source: string, minRun = MAX_SHARED_RUN): OverlapReport {
  const src = letters(source);
  const index = new Map<string, number[]>();
  const K = 8;
  for (let i = 0; i + K <= src.length; i++) {
    const key = src.slice(i, i + K);
    const list = index.get(key);
    if (list) list.push(i);
    else index.set(key, [i]);
  }

  let longestRun = 0;
  const copied: string[] = [];
  for (const paragraph of paragraphs) {
    const text = letters(paragraph);
    let i = 0;
    while (i + K <= text.length) {
      let best = 0;
      for (const start of index.get(text.slice(i, i + K)) ?? []) {
        let n = K;
        while (i + n < text.length && start + n < src.length && text[i + n] === src[start + n]) n++;
        if (n > best) best = n;
      }
      if (best > longestRun) longestRun = best;
      if (best >= minRun) {
        copied.push(text.slice(i, i + best));
        i += best;
      } else {
        i++;
      }
    }
  }
  return { longestRun, copied };
}
