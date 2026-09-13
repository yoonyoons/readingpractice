-- 시사 문해력 기르기 학습지 DB 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여 넣고 실행하세요. 여러 번 실행해도 안전합니다.
-- 모든 읽기/쓰기는 서버(Next.js)에서 secret key로만 하므로, RLS를 켜고 공개 정책은 만들지 않습니다.

create table if not exists teachers (
  id uuid primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key,
  teacher_id uuid not null references teachers(id) on delete cascade,
  name text not null,
  grade_level text not null check (grade_level in ('elem34', 'elem56', 'middle')),
  code text not null unique,
  auto_draft boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists classes_teacher_idx on classes (teacher_id);

create table if not exists students (
  id uuid primary key,
  class_id uuid not null references classes(id) on delete cascade,
  number int not null,
  name text not null,
  pin_hash text,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  unique (class_id, number)
);

create table if not exists worksheets (
  id uuid primary key,
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  articles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists worksheets_class_idx on worksheets (class_id, created_at desc);

create table if not exists submissions (
  id uuid primary key,
  worksheet_id uuid not null references worksheets(id) on delete cascade,
  article_id text not null,
  student_id uuid not null references students(id) on delete cascade,
  read_at timestamptz,
  quiz_answers jsonb not null default '{}'::jsonb,
  quiz_done_at timestamptz,
  summaries jsonb not null default '[]'::jsonb,
  opinion jsonb,
  updated_at timestamptz not null default now(),
  unique (worksheet_id, article_id, student_id)
);
create index if not exists submissions_student_idx on submissions (student_id);

-- 이전 버전 스키마로 이미 만든 DB를 위한 추가 열
alter table classes add column if not exists auto_draft boolean not null default false;
alter table submissions add column if not exists opinion jsonb;

alter table teachers enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table worksheets enable row level security;
alter table submissions enable row level security;
