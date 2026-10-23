/**
 * 관심 분야 학습의 별 규칙 (기사 한 편에 최대 3개). 서버·학생 화면이 함께 쓴다.
 * - 끝까지 읽고 퀴즈를 모두 풀면 ★1
 * - 퀴즈 정답률 70% 이상이면 ★1 더 (처음 고른 답만 셈)
 * - 요약 점수가 70점 이상이면 ★1 더 (여러 번 냈으면 가장 높은 점수)
 */
export const MAX_STARS = 3;
export const STAR_QUIZ_RATE = 0.7;
export const STAR_SUMMARY_SCORE = 70;

export function countStars({
  quizDone,
  quizCorrect,
  quizTotal,
  bestSummary,
}: {
  quizDone: boolean;
  quizCorrect: number;
  quizTotal: number;
  bestSummary: number | null;
}) {
  if (!quizDone) return 0;
  let stars = 1;
  if (quizTotal > 0 && quizCorrect / quizTotal >= STAR_QUIZ_RATE) stars++;
  if (bestSummary !== null && bestSummary >= STAR_SUMMARY_SCORE) stars++;
  return stars;
}
