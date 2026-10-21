-- AI Hub, step 2 of 2 (run 20261021120000_add_ai_member_role.sql first).
-- Creates NEW tables only; no existing table, policy or function changes.
--
--   ai_hub_members        one row per person who asked to join the AI Hub
--                         ($45 CAD / month, paid to Yana over WhatsApp). A
--                         row starts 'pending'; Admin -> AI Hub marks the
--                         payment received, which creates their login, sets
--                         status 'active' and expires_at = now + 30 days.
--                         Each further payment extends expires_at by 30 days.
--                         Access = status 'active' AND expires_at in the future.
--   ai_hub_words          a member's saved words/phrases (the "library").
--   ai_hub_quizzes        one AI-generated quiz per user per day.
--   ai_hub_news           one set of AI-written French news articles per day,
--                         shared by every member.
--   ai_hub_pronunciations a member's pronunciation attempts and AI feedback.
--
-- Usage tables are keyed by the Supabase auth user id (not the member row) so
-- an admin previewing the hub can use it too.
--
-- Access model: RLS on with NO policies and the anon/authenticated grants
-- revoked, so only the service-role key (lib/supabaseAdmin.ts) can touch them.
-- Safe to re-run.

create table if not exists public.ai_hub_members (
  id           text primary key, -- "aim-…"
  full_name    text not null,
  email        text not null unique check (email = lower(btrim(email))),
  whatsapp     text not null default '',
  user_id      uuid unique references auth.users (id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'active', 'deactivated')),
  expires_at   timestamptz,
  requested_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.ai_hub_words (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  term       text not null,
  meaning    text not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ai_hub_words_user_idx on public.ai_hub_words (user_id, created_at desc);

create table if not exists public.ai_hub_quizzes (
  user_id      uuid not null references auth.users (id) on delete cascade,
  quiz_date    date not null,
  level        text not null,
  questions    jsonb not null,  -- includes the answers; never sent to the client before submit
  answers      jsonb,           -- the member's submitted answers
  score        int,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (user_id, quiz_date)
);

create table if not exists public.ai_hub_news (
  news_date  date primary key,
  articles   jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_hub_pronunciations (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  phrase     text not null,
  evaluation jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_hub_pron_user_idx on public.ai_hub_pronunciations (user_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['ai_hub_members','ai_hub_words','ai_hub_quizzes','ai_hub_news','ai_hub_pronunciations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
