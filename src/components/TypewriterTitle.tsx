"use client";

import { useEffect, useState } from "react";

const TYPE_MS = 110;
const HOLD_MS = 2600;
const RESTART_MS = 500;

/**
 * 여러 줄 제목을 한 글자씩 타자 치듯 보여 주고, 다 쓰면 잠시 멈췄다가 처음부터 다시 쓴다.
 * 아직 안 쓴 글자도 투명하게 자리를 잡아 두어 글씨가 써지는 동안 화면이 흔들리지 않는다.
 * 움직임 줄이기 설정을 켠 사용자에게는 처음부터 전체 문장을 보여 준다.
 */
export function TypewriterTitle({ lines, className }: { lines: string[]; className?: string }) {
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  const [shown, setShown] = useState(total);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduced) return;
    let count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setShown(count);
      if (count < total) {
        count += 1;
        timer = setTimeout(tick, TYPE_MS);
      } else {
        timer = setTimeout(() => {
          count = 0;
          setShown(0);
          timer = setTimeout(tick, RESTART_MS);
        }, HOLD_MS);
      }
    };
    tick();
    return () => clearTimeout(timer);
  }, [reduced, total]);

  const visible = reduced ? total : shown;
  // 커서는 마지막으로 쓴 글자 바로 뒤(아직 한 글자도 안 썼으면 첫 줄 맨 앞)에 깜빡인다.
  const caret = (
    <span className="relative">
      <span className="absolute bottom-[0.12em] left-[0.1em] h-[0.95em] w-[0.07em] animate-[caret-blink_1s_step-end_infinite] bg-white" />
    </span>
  );
  const starts = lines.map((_, i) => lines.slice(0, i).reduce((sum, line) => sum + line.length, 0));
  return (
    <h2 className={className} aria-label={lines.join(" ")}>
      {lines.map((line, i) => {
        const start = starts[i];
        return (
          <span key={line} aria-hidden className="block">
            {!reduced && i === 0 && visible === 0 && caret}
            {Array.from(line).map((ch, j) => (
              <span key={j}>
                <span className={start + j < visible ? undefined : "opacity-0"}>{ch}</span>
                {!reduced && start + j === visible - 1 && caret}
              </span>
            ))}
          </span>
        );
      })}
    </h2>
  );
}
