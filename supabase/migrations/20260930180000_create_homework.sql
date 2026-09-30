-- Homework sent from Admin → Homework to one or more batches (see
-- lib/homeworkData.ts). A student sees every row whose batch_ids overlaps
-- a batch they're actively enrolled in. sections is the AI-structured body:
-- [{ "heading": text, "tasks": [text] }]. source_text keeps the admin's
-- original rough text for reference.
-- Same access model as the other tables: RLS on, no policies — only the
-- service-role key (lib/supabaseAdmin.ts) reaches it.

create table if not exists public.homework (
  id text primary key,
  title text not null,
  intro text not null default '',
  sections jsonb not null default '[]'::jsonb,
  batch_ids text[] not null,
  due_date date, -- calendar date in India time
  source_text text,
  created_at timestamptz not null default now()
);

create index if not exists homework_batch_ids_idx on public.homework using gin (batch_ids);
create index if not exists homework_created_at_idx on public.homework (created_at desc);

alter table public.homework enable row level security;

grant select, insert, update, delete on public.homework to anon, authenticated;
