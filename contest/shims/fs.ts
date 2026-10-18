/*
 * 개발용 파일 저장소(src/lib/db/local.ts)가 쓰는 fs 대신.
 * 파일 하나(db.json)를 이 브라우저의 localStorage에 저장한다. 쓸 수 없으면 메모리에만 둔다.
 */
const KEY = "contest-db";
let memory: string | null = null;

export const promises = {
  async readFile() {
    let text = memory;
    try {
      text = localStorage.getItem(KEY) ?? memory;
    } catch {
      // 메모리 값을 쓴다
    }
    if (text === null) throw new Error("ENOENT");
    return text;
  },
  async writeFile(_file: string, text: string) {
    memory = text;
    try {
      localStorage.setItem(KEY, text);
    } catch {
      // 용량을 넘거나 저장소를 쓸 수 없으면 메모리에만 둔다
    }
  },
  async mkdir() {},
};

export function clearStoredDb() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 지울 것이 없다
  }
}

const fs = { promises };
export default fs;
