"use client";

import { useEffect, useState } from "react";
import { BetaEnterButton, readBetaGrade, saveBetaGrade } from "@/components/teacher/BetaEnterButton";
import { GRADE_LIST } from "@/lib/grades";
import type { GradeLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 베타 체험 입장: 학년군 탭으로 학년군을 고른 뒤 선생님·학생으로 들어간다. 고른 학년군은 이 브라우저에 기억한다 */
export function BetaEnter() {
  const [grade, setGrade] = useState<GradeLevel>("elem56");
  const [remembered, setRemembered] = useState(false);

  useEffect(() => {
    const saved = readBetaGrade();
    if (!saved) return;
    // 저장소에서 읽은 값으로 처음 한 번만 정하는 상태라 effect 안에서 바꾼다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrade(saved);
    setRemembered(true);
  }, []);

  function choose(next: GradeLevel) {
    setGrade(next);
    setRemembered(false);
    saveBetaGrade(next);
  }

  return (
    <div className="mt-6">
      <p className="text-[14px] font-semibold text-grey-700">학년군</p>
      <div role="radiogroup" aria-label="학년군" className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-grey-100 p-1">
        {GRADE_LIST.map((g) => (
          <button
            key={g.level}
            type="button"
            role="radio"
            aria-checked={grade === g.level}
            onClick={() => choose(g.level)}
            className={cn(
              "h-11 rounded-xl text-[15px] font-semibold transition",
              grade === g.level ? "bg-white text-grey-900 shadow-sm" : "text-grey-500 hover:text-grey-700",
            )}
          >
            {g.label.replace("학년", "")}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-grey-500">
        {remembered ? "지난번에 고른 학년군이에요. " : ""}이번 주 기사가 이 학년 수준으로 나와요.
      </p>
      <div className="mt-5 space-y-1">
        <BetaEnterButton as="teacher" grade={grade} />
        <BetaEnterButton as="student" grade={grade} variant="secondary" />
      </div>
    </div>
  );
}
