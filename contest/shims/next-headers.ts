import { SITE } from "../app/site";

/*
 * next/headers 대신: 쿠키(로그인 상태)를 이 브라우저의 localStorage에 둔다.
 * 저장소를 쓸 수 없는 환경(사생활 보호 창 등)에서는 메모리에만 둔다.
 */
const KEY = "contest-cookies";
let memory: Record<string, string> = {};

function load(): Record<string, string> {
  try {
    memory = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    // 메모리 값을 그대로 쓴다
  }
  return memory;
}

function save(jar: Record<string, string>) {
  memory = jar;
  try {
    localStorage.setItem(KEY, JSON.stringify(jar));
  } catch {
    // 메모리에만 남긴다
  }
}

const jar = {
  get(name: string) {
    const value = load()[name];
    return value === undefined ? undefined : { name, value };
  },
  set(name: string, value: string) {
    save({ ...load(), [name]: value });
  },
  delete(name: string) {
    const next = { ...load() };
    delete next[name];
    save(next);
  },
};

export async function cookies() {
  return jar;
}

export function clearCookies() {
  save({});
}

export async function headers() {
  const url = new URL(SITE);
  return new Headers({ host: url.host, "x-forwarded-proto": url.protocol.replace(":", "") });
}
