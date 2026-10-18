/** node crypto 대신 (체험판에서 쓰는 함수만) */
function bytes(n: number) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function randomBytes(n: number) {
  const b = bytes(n);
  return { toString: () => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("") };
}

export function randomInt(min: number, max?: number) {
  const [lo, hi] = max === undefined ? [0, min] : [min, max];
  return lo + (bytes(4).reduce((a, x) => a * 256 + x, 0) % (hi - lo));
}

export function randomUUID() {
  const h = randomBytes(16).toString();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** 인증 코드 비교용 해시. 체험판은 이 브라우저 안에서만 쓰므로 간단한 해시로 충분하다 */
export function createHash() {
  let text = "";
  const api = {
    update(value: string) {
      text += value;
      return api;
    },
    digest() {
      let h1 = 0x811c9dc5;
      let h2 = 0x01000193;
      for (let i = 0; i < text.length; i++) {
        h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619);
        h2 = Math.imul(h2 ^ text.charCodeAt(i), 2246822519);
      }
      return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
    },
  };
  return api;
}

const crypto = { randomBytes, randomInt, randomUUID, createHash };
export default crypto;
