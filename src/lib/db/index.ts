import { hasSupabase } from "../env";
import { createLocalRepo } from "./local";
import type { Repo } from "./repo";
import { createSupabaseRepo } from "./supabase";

let repo: Repo | undefined;

export function getDb(): Repo {
  repo ??= hasSupabase() ? createSupabaseRepo() : createLocalRepo();
  return repo;
}
