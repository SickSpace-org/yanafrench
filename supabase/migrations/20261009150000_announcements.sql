-- Teacher Portal, Phase 5: one-way announcements to students. Creates two
-- NEW tables; does not alter any existing table, policy or function, so it
-- can't affect current admins or students. The existing Messages thread
-- (student <-> Yana, stored in R2) is untouched.
--
--   announcements      one row per announcement, from a batch's teacher or
--                      from the admin, to either the whole batch
--                      (student_id null) or one student in it. Students see
--                      them in their Notifications. Permanent for teachers
--                      (no edit/delete); the admin can delete any of them.
--                      sender_name keeps the name as it was, and teacher_id
--                      becomes null if the teacher is removed. batch_id is
--                      the R2 batch id (no foreign key — batches aren't in
--                      Postgres). Deleting a student deletes announcements
--                      addressed to them alone.
--
--   announcement_seen  one row per student: when they last opened their
--                      Notifications. Announcements newer than this show as
--                      unread (the dot on Notifications).
--
-- Access model: RLS on, NO policies, anon/authenticated grants revoked —
-- only the service-role key (server routes) can read or write.
--
-- Safe to re-run: IF NOT EXISTS everywhere; revoke/enable are idempotent.

create table if not exists public.announcements (
  id          text primary key, -- "ann-…"
  batch_id    text not null,
  student_id  text references public.students (id) on delete cascade, -- null = whole batch
  sender_type text not null check (sender_type in ('teacher', 'admin')),
  teacher_id  text references public.teachers (id) on delete set null,
  sender_name text not null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists announcements_batch_idx on public.announcements (batch_id, created_at desc);
create index if not exists announcements_student_idx on public.announcements (student_id) where student_id is not null;

alter table public.announcements enable row level security;
revoke all on table public.announcements from anon, authenticated;

create table if not exists public.announcement_seen (
  student_id text primary key references public.students (id) on delete cascade,
  seen_at    timestamptz not null default now()
);

alter table public.announcement_seen enable row level security;
revoke all on table public.announcement_seen from anon, authenticated;

notify pgrst, 'reload schema';
