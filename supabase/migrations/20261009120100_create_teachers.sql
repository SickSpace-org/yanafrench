-- Teacher Portal, step 2 of 2 (run 20261009120000_add_teacher_role.sql
-- first). Creates two NEW tables. It does not alter any existing table,
-- policy or function, so it can't affect current admins or students.
--
--   teachers        one row per teacher, created by the admin from
--                   Admin -> Teachers (teachers never self-register). Linked
--                   to their Supabase Auth login by user_id once the invite
--                   is sent. status 'deactivated' cuts off portal access on
--                   the very next request (lib/teachers.ts checks it every
--                   time) while keeping the row and its history.
--
--   batch_teachers  which teacher runs which batch. One teacher per batch
--                   (batch_id is the primary key); a batch with no row here
--                   stays with Yana (admin). Batches themselves live in R2
--                   (data/portal-state.json), not in Postgres, so batch_id
--                   can't be a foreign key:
--                     - renaming a batch keeps its id, so the assignment
--                       follows it automatically;
--                     - deleting a batch in Admin -> Batches also deletes
--                       its row here (app/api/portal-state), and every
--                       teacher read ignores a row whose batch no longer
--                       exists in R2, so a leftover row grants nothing.
--                   Removing a teacher deletes their assignments (cascade),
--                   which returns those batches to Yana.
--
-- Access model: same as every other app table — RLS on with NO policies,
-- so only the service-role key (lib/supabaseAdmin.ts) can read or write
-- these. Unlike the older tables, the anon/authenticated grants are also
-- revoked, so the Data API can't reach them even if a policy were ever
-- added by mistake.
--
-- Safe to re-run: IF NOT EXISTS everywhere; revoke/enable are idempotent.

create table if not exists public.teachers (
  id         text primary key, -- "teacher-…"
  full_name  text not null,
  email      text not null unique check (email = lower(btrim(email))),
  user_id    uuid unique references auth.users (id) on delete set null,
  status     text not null default 'active' check (status in ('active', 'deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teachers enable row level security;
revoke all on table public.teachers from anon, authenticated;

create table if not exists public.batch_teachers (
  batch_id    text primary key, -- R2 batch id (lib/batchData.ts)
  teacher_id  text not null references public.teachers (id) on delete cascade,
  assigned_at timestamptz not null default now()
);

create index if not exists batch_teachers_teacher_id_idx on public.batch_teachers (teacher_id);

alter table public.batch_teachers enable row level security;
revoke all on table public.batch_teachers from anon, authenticated;

notify pgrst, 'reload schema';
