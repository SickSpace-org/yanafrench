-- Le Kiosque: speaking topics Yana adds in Admin -> Le Kiosque. Members get
-- one at random when they press "Give me a topic" in Speak as monologue.
-- Same access model as the other ai_hub tables: RLS on, no policies, anon and
-- authenticated revoked, so only the service-role key can touch it.
-- Safe to re-run.

create table if not exists public.ai_hub_topics (
  id         text primary key, -- "top-…"
  topic      text not null,
  points     text not null default '', -- optional comma-separated things to cover
  created_at timestamptz not null default now()
);

alter table public.ai_hub_topics enable row level security;
revoke all on public.ai_hub_topics from anon, authenticated;
