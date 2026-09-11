-- ─────────────────────────────────────────────────────────────────────────────
-- Auth setup for yanafrench — Phase 1
--
-- This project has no Supabase CLI migration tooling (the existing tables were
-- created by hand). This file is the source of record; apply it once against
-- the project database, e.g.:
--
--   psql "$POSTGRES_URL_NON_POOLING" -f db/auth-setup.sql
--
-- It is idempotent — safe to re-run.
--
-- After applying, two DASHBOARD steps are still required (no API for them):
--   1. Authentication → Providers → Email: turn OFF "Allow new users to sign up".
--   2. Authentication → Hooks: enable "Custom Access Token" and point it at
--      public.custom_access_token_hook. (Until then the app resolves roles by
--      querying user_roles directly — slower, but correct.)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Role enum ---------------------------------------------------------------
do $$
begin
  create type public.app_role as enum ('admin', 'student');
exception
  when duplicate_object then null;
end $$;

-- 2. user_roles: one row per auth user, the source of truth for authorization
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.app_role not null default 'student',
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- A signed-in user may read *their own* role (used by proxy.ts / getViewer as
-- the fallback path before the access-token hook is enabled). No insert/update/
-- delete policy: only the service role writes roles.
drop policy if exists "read own role" on public.user_roles;
create policy "read own role"
  on public.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 3. Custom Access Token hook ----------------------------------------------
-- Injects `user_role` as a top-level JWT claim so proxy.ts / getViewer can
-- read the role with no database round-trip. Must be enabled in the dashboard
-- (Authentication → Hooks) to take effect.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims     jsonb;
  found_role public.app_role;
begin
  select role
    into found_role
    from public.user_roles
   where user_id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  if found_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(found_role::text));
  else
    claims := jsonb_set(claims, '{user_role}', 'null'::jsonb);
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- The hook executes as supabase_auth_admin during token issuance.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table public.user_roles to supabase_auth_admin;

drop policy if exists "auth admin reads roles" on public.user_roles;
create policy "auth admin reads roles"
  on public.user_roles
  for select
  to supabase_auth_admin
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- NOT in Phase 1 (here for reference — applied in Phase 3):
--
--   alter table public.students
--     add column user_id uuid unique references auth.users (id) on delete set null;
--
--   create policy "students read own" on public.students
--     for select to authenticated using (user_id = (select auth.uid()));
--   create policy "students admin all" on public.students
--     for all to authenticated
--     using   ((auth.jwt() ->> 'user_role') = 'admin')
--     with check ((auth.jwt() ->> 'user_role') = 'admin');
-- ─────────────────────────────────────────────────────────────────────────────
