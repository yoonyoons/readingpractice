/** 체험판 안내 메시지 (화면 아래에 잠깐 띄운다) */
export function toast(message: string, ms = 6000) {
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.className =
    "fixed bottom-6 left-1/2 z-[100] w-[min(92vw,480px)] -translate-x-1/2 rounded-2xl bg-grey-900 px-5 py-4 text-[14px] leading-relaxed text-white shadow-[0_8px_30px_rgba(0,0,0,0.25)] animate-fade-up";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
