-- A student's answers to one homework (see lib/homeworkData.ts). One row
-- per (homework, student); resubmitting overwrites answers and bumps
-- updated_at. answers mirrors the homework's shape: one array of strings
-- per section, one string per task — [["ans 1", "ans 2"], ["ans 1"]].
-- Same access model as the other tables: RLS on, no policies — only the
-- service-role key (lib/supabaseAdmin.ts) reaches it.

create table if not exists public.homework_submissions (
  id text primary key,
  homework_id text not null references public.homework(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists homework_submissions_homework_student_uniq
  on public.homework_submissions (homework_id, student_id);
create index if not exists homework_submissions_student_idx
  on public.homework_submissions (student_id);

alter table public.homework_submissions enable row level security;

grant select, insert, update, delete on public.homework_submissions to anon, authenticated;
