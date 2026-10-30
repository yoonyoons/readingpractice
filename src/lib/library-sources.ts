import type { LibraryField } from "./types";

/**
 * 관심 분야 학습 기사의 원문으로 쓸 수 있는 사이트 (2026-10-30 각 사이트 저작권 정책 확인).
 * 처음 기사·자동 추가 기사 모두 원문 주소가 여기 있는 곳이어야 학생에게 보인다.
 *
 * - 미국 연방 정부 기관(NASA·NOAA·USGS)의 공공 저작물: 복제·가공·재배포 자유
 * - 정책브리핑(korea.kr): 모든 글에 공공누리 제1유형 표시
 * - 기상청·국립생태원: 글마다 공공누리 유형이 달라 제1유형 표시가 있는 글만 쓴다 (kogl1Only)
 * - 한국은행·경제배움e+: 공공누리 제1유형이 아니어서 내용만 참고해 새로 쓴다(원문 복제 없음).
 *   경제배움e+는 여러 기관 자료를 모은 곳이라 정부 기관이 올린 글만 쓴다
 *
 * 쓰지 않는 곳: 우리역사넷(개인 학술·연구 목적만 허용), KDI 경제정보센터(사전 동의 없는 복제 금지),
 * Smithsonian(CC0 표시 자료 말고는 저작권 있음), 미국 연방준비제도·의회도서관·국립민속박물관·국립한글박물관(목록에 없음)
 */
export interface LibrarySource {
  name: string;
  /** 이 도메인과 그 하위 도메인의 글을 쓴다 */
  hosts: string[];
  fields: LibraryField[];
  /** 공공누리 제1유형 표시가 있는 글만 쓴다 */
  kogl1Only?: boolean;
}

export const LIBRARY_SOURCES: LibrarySource[] = [
  { name: "NASA (Space Place·Climate Kids 포함)", hosts: ["nasa.gov"], fields: ["space", "earth"] },
  { name: "NOAA", hosts: ["noaa.gov"], fields: ["earth"] },
  { name: "USGS(미국 지질조사국)", hosts: ["usgs.gov"], fields: ["earth"] },
  { name: "기상청", hosts: ["kma.go.kr", "weather.go.kr"], fields: ["earth"], kogl1Only: true },
  { name: "국립생태원", hosts: ["nie.re.kr"], fields: ["earth"], kogl1Only: true },
  { name: "한국은행", hosts: ["bok.or.kr"], fields: ["economy"] },
  { name: "경제배움e+ (정부 기관 자료)", hosts: ["econedu.go.kr"], fields: ["economy"] },
  { name: "대한민국 정책브리핑", hosts: ["korea.kr"], fields: ["culture", "economy", "earth", "space"] },
];

export function sourceOf(url: string): LibrarySource | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return LIBRARY_SOURCES.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`))) ?? null;
}

export const isApprovedOrigin = (url: string) => sourceOf(url) !== null;

/** 원문 페이지 HTML에 공공누리 제1유형 표시가 있는지 본다 */
export function hasKogl1Mark(html: string): boolean {
  return /공공누리[^<]{0,40}(제\s*)?1\s*유형|license_type=1\b|licenseType1\b|opentype0?1\b|img_opentype0?1|codetype1\b|kogl_?type_?0?1\b/i.test(html);
}
