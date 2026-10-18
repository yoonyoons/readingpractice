import { useMemo, useSyncExternalStore } from "react";
import { currentLocation, navigate, refresh, subscribe } from "./router";

/** redirect()·notFound()가 던지는 신호. 화면을 그리는 쪽(app/main.tsx)에서 받아 처리한다 */
export class RedirectSignal extends Error {
  constructor(public href: string) {
    super(`redirect ${href}`);
  }
}
export class NotFoundSignal extends Error {}

export function redirect(href: string): never {
  throw new RedirectSignal(href);
}

export function notFound(): never {
  throw new NotFoundSignal("not found");
}

const router = {
  push: (href: string) => navigate(href),
  replace: (href: string) => navigate(href, true),
  refresh: () => refresh(),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  prefetch: () => {},
};

export function useRouter() {
  return router;
}

const hash = () => window.location.hash;
const subscribeHash = (cb: () => void) => subscribe(cb);

export function usePathname() {
  useSyncExternalStore(subscribeHash, hash);
  return currentLocation().pathname;
}

export function useSearchParams() {
  const h = useSyncExternalStore(subscribeHash, hash);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new URLSearchParams(currentLocation().search), [h]);
}
