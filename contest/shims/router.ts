/*
 * 체험판 주소 이동. 파일(file://)로 열어도 동작하도록 주소를 # 뒤에 둔다. (예: index.html#/teacher)
 */

export interface Location {
  pathname: string;
  search: string;
}

type Listener = (refresh: boolean) => void;
const listeners = new Set<Listener>();

export function currentLocation(): Location {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathname, search = ""] = raw.split("?");
  return { pathname: pathname || "/", search: search ? `?${search}` : "" };
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(refresh: boolean) {
  listeners.forEach((l) => l(refresh));
}

window.addEventListener("hashchange", () => {
  window.scrollTo(0, 0);
  emit(false);
});

export function navigate(href: string, replace = false) {
  const target = `#${href}`;
  if (window.location.hash === target) return emit(true);
  if (replace) {
    window.history.replaceState(null, "", target);
    window.scrollTo(0, 0);
    emit(false);
  } else {
    window.location.hash = href;
  }
}

export function refresh() {
  emit(true);
}
