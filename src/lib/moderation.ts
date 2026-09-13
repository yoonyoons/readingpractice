/**
 * 학생 글(요약·생각 나누기)을 AI에 보내거나 친구들에게 보여주기 전에 거르는 간단한 규칙.
 * 문제가 있으면 학생에게 보여줄 안내 문구를, 없으면 null을 돌려준다.
 */

const PERSONAL_INFO_PATTERNS = [
  /01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/, // 휴대전화 번호
  /\b0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4}\b/, // 일반 전화번호
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // 이메일
  /\d{6}[\s-]?[1-4]\d{6}/, // 주민등록번호
];

// 띄어쓰기·숫자·기호를 끼워 넣어도 걸리도록 한글·자모만 남기고 비교한다
const BAD_WORDS = [
  "씨발", "시발", "씨빨", "씨바", "ㅅㅂ", "ㅆㅂ", "병신", "븅신", "ㅂㅅ", "개새끼", "개새기", "개색기", "좆", "존나", "ㅈㄴ",
  "지랄", "ㅈㄹ", "닥쳐", "썅", "느금마", "니애미", "엠창", "등신",
];

export function checkStudentText(text: string): string | null {
  if (PERSONAL_INFO_PATTERNS.some((pattern) => pattern.test(text))) {
    return "전화번호·이메일 같은 개인정보는 쓰지 않아요. 지우고 다시 제출해 주세요.";
  }
  const compact = text.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, "");
  if (BAD_WORDS.some((word) => compact.includes(word))) {
    return "바르고 고운 말로 고쳐 써 주세요.";
  }
  return null;
}
