-- One class meeting link (Zoom / Meet / …) per batch, set in Admin ->
-- Attendance (see lib/classLinks.ts). Only students enrolled in the batch
-- get it — from their dashboard and through "Join class". Same access
-- model as the other tables: RLS on, no policies, service-role key only.

create table if not exists public.class_links (
  batch_id text primary key,
  url text not null,
  updated_at timestamptz not null default now()
);

alter table public.class_links enable row level security;

notify pgrst, 'reload schema';
