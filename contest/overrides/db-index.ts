import { createLocalRepo } from "@/lib/db/local";
import type { Repo } from "@/lib/db/repo";

/** 체험판은 Supabase 대신 이 브라우저에 저장하는 개발용 저장소만 쓴다 */
let repo: Repo | undefined;

export function getDb(): Repo {
  repo ??= createLocalRepo();
  return repo;
}
