# 시사 문해력 기르기 학습지

이번 주 주요 뉴스로 학생들의 어휘력·문해력을 기르는 웹앱입니다.
교사가 버튼을 누르면(또는 매주 월요일 아침 자동으로) Brave 뉴스 검색으로 지난 7일 한국·세계 주요 뉴스를 모아 AI(Claude)가 주제 2개를 고르고(정치·일일 날씨 제외), 반의 학년군 수준에 맞춘 기사·어휘 퀴즈·생각 나누기 질문을 만듭니다. 교사가 검토·수정 후 배포하면 학생은 **기사 읽기 → 어휘 퀴즈 → 스스로 요약(AI 피드백) → 생각 나누기** 순서로 학습합니다.

## 주요 기능

| 구분 | 기능 |
| --- | --- |
| 교사 | 이메일 가입/로그인, 반 만들기(초3~4 / 초5~6 / 중학생), 반 코드 발급, 학생 PIN 초기화 |
| 교사 | 학습지 생성(진행 상황 실시간 표시), 기사·어휘·퀴즈·채점 기준·생각 나누기 질문 편집, 기사별 다시 만들기, 배포/배포 취소 |
| 교사 | **주간 초안 자동 준비**: 반마다 켜 두면 매주 월요일 오전 6시(한국 시간)에 초안 생성 → 검토 후 배포 |
| 교사 | 학생별 완독·퀴즈·요약 점수·생각 표, 요약문과 AI 피드백·의견 상세 보기, 부적절한 의견 숨기기, CSV 내려받기 |
| 학생 | 반 코드 + 번호·이름 + PIN 4자리로 입장 (PIN 5회 오류 시 5분 잠금) |
| 학생 | 기사 읽기: 스크롤 끝 + 최소 읽기 시간을 채워야 다음 단계, 핵심 어휘를 누르면 뜻 보기 |
| 학생 | 어휘 퀴즈: 빈칸 채우기·비슷한 말·내용 이해, 문항마다 정답·해설 (첫 답만 점수에 반영) |
| 학생 | 요약: 100점 만점(핵심 내용 50 / 내 말로 표현 30 / 문장 완성도 20) + 잘한 점·빠진 내용·조언, 최대 3회 제출 |
| 학생 | 생각 나누기: 입장 선택 + 까닭 쓰기(필수) → 제출 후 반 친구들의 입장 비율과 의견을 이름 없이 보기 |
| 안전 | AI 사용 고지(입장·기사·피드백 화면), 학생 글의 개인정보·욕설 차단(AI 전송 전), [운영 정책 페이지](src/app/policy/page.tsx) |

## 바로 실행해 보기 (데모 모드)

API 키가 없어도 실행됩니다. 이때는 예시 기사로 학습지가 만들어지고, 요약은 간단한 규칙으로 채점하며, 데이터는 `.data/db.json` 파일에 저장됩니다.

```bash
npm install
npm run dev
```

http://localhost:3000 에 접속 → **선생님으로 시작하기**에서 가입 → 반 만들기 → 학습지 만들기 → 배포 → 다른 브라우저(또는 시크릿 창)에서 **학생으로 시작하기**.

## 실제 뉴스로 운영하기

`.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

1. **Brave Search API** — [Brave API 대시보드](https://api-dashboard.search.brave.com)에서 가입 → 크레딧 충전(선불, 1,000회당 약 $5) → API Keys에서 키 발급 → `BRAVE_API_KEY`. 학습지 1회 생성에 약 15회(약 $0.08)를 씁니다.
2. **Anthropic API** — [Claude Console](https://platform.claude.com)에서 결제 수단 등록 후 API Keys에서 키 발급 → `ANTHROPIC_API_KEY` (모델은 `CLAUDE_MODEL`로 바꿀 수 있고 기본값은 `claude-opus-5`).
3. **Supabase** — 프로젝트 생성 → SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql) 실행(이미 만든 DB에 다시 실행해도 새 열만 추가됨) → Project Settings > API의 URL과 secret(service_role) key → `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
4. **SESSION_SECRET**, **CRON_SECRET** — 각각 32자 이상 무작위 문자열 (예: `openssl rand -base64 32`)
5. (선택) **TEACHER_SIGNUP_CODE** — 넣으면 이 코드를 아는 사람만 교사로 가입할 수 있습니다.

## Vercel 배포

1. GitHub 저장소를 Vercel에서 Import
2. Settings > Environment Variables에 위 값을 모두 입력 (배포 환경에서는 Supabase, SESSION_SECRET, CRON_SECRET이 필수)
3. Deploy — `vercel.json`의 Cron 설정(`0 21 * * 0` = 매주 월요일 06:00 KST)이 자동으로 등록됩니다.

학습지 생성은 뉴스 수집을 포함해 1~3분 걸리므로 함수 최대 실행 시간을 300초로 설정해 두었습니다(`maxDuration`).

## 동작 방식

```
[교사: 학습지 만들기]  또는  [월요일 06:00 Cron: 자동 준비를 켠 반]
  ① Brave News API ── 한국어 9개·영어 4개 검색어로 지난 7일 기사 수백 건 수집(freshness=pw)
        │                중복 제거, 정치·날씨 기사는 정규식으로 1차 제외         (src/lib/brave.ts)
        │
  ② Claude (JSON 출력) ── 제목·요약을 사건별로 묶어 주제 2개 선정: 분야 목록에 정치·날씨가 없음
        │                  주제별 확인된 사실 5~8개 + 출처, 주제명으로 Brave 추가 검색해 보강 (src/lib/topics.ts)
        │                  Anthropic 키가 없으면 제목 단어 빈도로 키워드 2개 선정
        │
  ③ 주제별로 동시에: Claude (JSON 출력) ── 확인된 사실만으로 학년군 기준(분량·문장·어휘·문체)에 맞춘
        │                                    기사·어휘·퀴즈·채점 기준·생각 나누기 질문 작성
        │                                    → 서버에서 퀴즈 형식 검증(보기 4개, 정답 포함), 보기 순서 섞기
        ▼
  초안 저장(출처 목록 포함) → 교사 검토·수정 → 배포
```

- `npm run news` 로 서버 없이 뉴스 수집·주제 선정 결과를 확인할 수 있습니다 (`BRAVE_API_KEY`만 있어도 동작).
- Claude Opus 5 요청에는 `fallbacks: "default"`를 켜 두어, 안전 분류기가 요청을 거절하면 서버에서 권장 모델로 다시 시도합니다.
- 자동 준비는 주제를 한 번만 고르고 학년군마다 기사 한 세트를 만들어, 같은 학년군 반들에 id만 새로 매겨 복사합니다. 최근 12시간 안에 학습지를 만든 반은 건너뜁니다.
- 퀴즈 정답·해설과 모범 요약은 학생 화면으로 미리 보내지 않고, 답을 제출한 뒤 서버가 알려 줍니다.
- 학생 요약문은 채점을 위해 Claude에 보내지만 이름·번호는 보내지 않습니다. 전화번호·이메일·욕설이 있으면 AI에 보내기 전에 제출을 막습니다.
- 친구 의견판에는 이름·학생 id가 포함되지 않으며, 교사가 숨긴 의견은 본인에게만 보입니다.
- 모든 DB 접근은 서버에서만 이뤄지며, Supabase 테이블은 RLS를 켜고 공개 정책을 두지 않았습니다.

## 폴더 구조

```
src/
  app/
    page.tsx                         첫 화면
    policy/                          운영 정책(개인정보·AI 이용 안내)
    join/                            학생 입장
    s/                               학생 홈, 기사별 학습 화면
    teacher/                         교사 로그인·가입, 반 목록, 반 상세, 학습지 편집·결과
    api/                             Route Handlers (교사·반·학습지·학생·cron)
  components/
    ui.tsx                           토스 스타일 공통 컴포넌트
    student/LessonFlow.tsx           읽기 → 퀴즈 → 요약 → 피드백 → 생각 나누기
    teacher/WorksheetView.tsx        학습지 편집 + 결과 표
  lib/
    brave.ts                         Brave 뉴스 검색으로 지난 7일 기사 수집
    topics.ts                        수집한 뉴스에서 주제 2개 선정 (Claude / 단어 빈도)
    claude.ts                        Claude 호출 (JSON 출력)
    generation.ts                    주제 선정·기사/퀴즈 생성 프롬프트와 검증
    weekly.ts                        주간 초안 자동 준비
    feedback.ts                      요약 채점
    moderation.ts                    학생 글 개인정보·욕설 차단
    grades.ts                        학년군별 기준
    db/                              저장소 (Supabase / 로컬 파일)
scripts/collect-news.mts             뉴스 수집·주제 선정 시험 스크립트 (npm run news)
supabase/schema.sql                  DB 스키마
vercel.json                          주간 Cron 설정
```

## 알아 둘 점

- **뉴스 출처**: 네이버 검색 API는 2026년 9월 개정 약관으로 AI 입력이 금지되어 쓰지 않습니다. Gemini API는 18세 미만이 이용할 가능성이 높은 서비스에서 사용이 금지되고, 검색 연동 결과의 저장·재배포도 제한되어 쓰지 않습니다.
- **미성년자 대상 운영**: Anthropic의 [미성년자 대상 서비스 지침](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors)에 따라 AI 사용 고지, 콘텐츠 필터링, 운영 정책 명시를 넣었습니다. 운영 정책 페이지의 운영 주체·문의처는 학교 상황에 맞게 고쳐 쓰고, 만 14세 미만 학생 정보 처리는 학교 개인정보 절차를 따르세요.
- **AI 검토**: AI가 만든 기사에는 사실 오류가 있을 수 있으므로 배포 전 교사 검토를 전제로 설계했습니다. 자동 준비도 초안까지만 만들고 배포는 교사가 합니다.
- **저작권**: 기사는 출처 문장을 옮기지 않고 새로 쓰며 출처 목록을 함께 보여줍니다.
- **비용**: 학습지 1회 생성에 Brave 검색 약 15회(1,000회당 약 $5)와 Claude 호출 3회, 요약 채점은 제출 1회당 Claude 1회입니다. Brave는 검색 결과를 AI 입력으로 쓰는 것을 허용합니다.
