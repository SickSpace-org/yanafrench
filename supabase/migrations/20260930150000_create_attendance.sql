-- Class attendance (see lib/attendanceData.ts for the rules). One row per
-- (student, batch, class date) — written either automatically when the
-- student clicks "Join class" within the first 15 minutes of that class
-- (source 'auto', always 'present'), or by an admin marking present/absent
-- by hand (source 'manual', which always wins over 'auto'). "Absent" is
-- usually not stored at all: a finished class with no row is absent.
-- Same access model as the other tables: RLS on, no policies — only the
-- service-role key (lib/supabaseAdmin.ts) reaches it.

create table if not exists public.attendance (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  batch_id text not null,
  class_date date not null, -- calendar date in India time
  status text not null, -- present | absent
  source text not null, -- auto | manual
  marked_at timestamptz not null default now()
);

create unique index if not exists attendance_student_batch_date_uniq
  on public.attendance (student_id, batch_id, class_date);
create index if not exists attendance_batch_date_idx
  on public.attendance (batch_id, class_date);

alter table public.attendance enable row level security;

grant select, insert, update, delete on public.attendance to anon, authenticated;
