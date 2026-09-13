/**
 * Brave 뉴스 수집·주제 추출 모듈을 서버 없이 시험한다.
 *   npm run news            → 지난 7일 뉴스 수집 후 주제 2개 출력
 *   npm run news -- --json  → 결과를 JSON으로 출력
 * BRAVE_API_KEY만 있으면 단어 빈도 방식으로, ANTHROPIC_API_KEY도 있으면 Claude가 사건별로 묶어 고른다.
 */
// @next/env 는 CommonJS 모듈이라 기본 가져오기로 읽는다
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const [{ collectWeeklyNews }, { pickTopicsFromNews }, { hasAnthropic, hasBrave }] = await Promise.all([
  import("../src/lib/brave"),
  import("../src/lib/topics"),
  import("../src/lib/env"),
]);

if (!hasBrave()) {
  console.error(".env.local 에 BRAVE_API_KEY 를 넣어 주세요.");
  process.exit(1);
}

const asJson = process.argv.includes("--json");
const started = Date.now();

console.error("Brave 뉴스 검색 중... (검색어 13개, 약 15초)");
const collected = await collectWeeklyNews();
console.error(
  `수집 ${collected.items.length}건 (정치·날씨 제외 ${collected.excluded}건) · ` +
    collected.perQuery.map((q) => `${q.query} ${q.count}`).join(", "),
);

console.error(hasAnthropic() ? "Claude가 사건별로 묶어 주제를 고르는 중..." : "ANTHROPIC_API_KEY 가 없어 제목 단어 빈도로 주제를 고릅니다.");
const topics = await pickTopicsFromNews(collected.items, 2);

const queries = collected.queriesUsed + topics.length;
console.error(`완료 · Brave 검색 ${queries}회 (약 $${(queries * 0.005).toFixed(3)}) · ${((Date.now() - started) / 1000).toFixed(1)}초\n`);

if (asJson) {
  console.log(JSON.stringify({ topics, sample: collected.items.slice(0, 30) }, null, 2));
} else {
  topics.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name}  (${t.method === "claude" ? "AI 선정" : "단어 빈도"} · 출처 ${t.sources.length}곳 · 관련 기사 ${t.mentionCount}건)`);
    console.log(`   ${t.summary}`);
    for (const fact of t.facts.slice(0, 6)) console.log(`   - ${fact.slice(0, 120)}`);
    for (const s of t.sources.slice(0, 4)) console.log(`   · ${s.title.slice(0, 70)}  ${s.url}`);
    console.log();
  });
}
