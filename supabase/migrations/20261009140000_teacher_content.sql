-- Teacher Portal, Phase 4: per-batch class content and the teacher
-- activity log. Creates three NEW tables; does not alter any existing
-- table, policy or function, so it can't affect current admins or students.
--
--   batch_recordings       class recording LINKS (Zoom cloud, YouTube
--                          unlisted, Drive…) for one batch. Links only — no
--                          video hosting. Students actively enrolled in the
--                          batch see them under Lessons -> Recordings.
--
--   batch_materials        files (PDFs, slides…) for one batch. The bytes
--                          live in a PRIVATE R2 bucket (R2_PRIVATE_BUCKET_NAME,
--                          never the public one) under
--                          batch-materials/<batch_id>/…; this row is the
--                          metadata. Downloads are short-lived signed URLs,
--                          issued only after checking the viewer is the
--                          batch's teacher, a student actively in the batch,
--                          or the admin (app/api/materials/[id]/download).
--
--   teacher_content_audit  append-only log of what teachers create, change
--                          and delete (class links, recordings, materials,
--                          announcements), shown on Admin -> Teachers.
--                          content_id has no foreign key on purpose, so the
--                          log outlives the thing it describes.
--
-- History survives a teacher being removed: teacher_id becomes null
-- (ON DELETE SET NULL) and author_name / teacher_name keep the name as it
-- was. batch_id is the R2 batch id (batches aren't in Postgres), so there's
-- no foreign key; content of a deleted batch is simply no longer shown.
--
-- Access model: RLS on, NO policies, anon/authenticated grants revoked —
-- only the service-role key (server routes) can read or write.
--
-- Safe to re-run: IF NOT EXISTS everywhere; revoke/enable are idempotent.

create table if not exists public.batch_recordings (
  id          text primary key, -- "rec-…"
  batch_id    text not null,
  teacher_id  text references public.teachers (id) on delete set null,
  author_name text not null,
  title       text not null,
  url         text not null,
  class_date  date, -- India time
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists batch_recordings_batch_idx on public.batch_recordings (batch_id, created_at desc);

alter table public.batch_recordings enable row level security;
revoke all on table public.batch_recordings from anon, authenticated;

create table if not exists public.batch_materials (
  id           text primary key, -- "mat-…"
  batch_id     text not null,
  teacher_id   text references public.teachers (id) on delete set null,
  author_name  text not null,
  title        text not null,
  storage_key  text not null unique, -- private bucket key, batch-materials/<batch_id>/…
  file_name    text not null,
  content_type text not null,
  size_bytes   bigint not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint batch_materials_key_in_batch_folder check (storage_key like 'batch-materials/' || batch_id || '/%')
);

create index if not exists batch_materials_batch_idx on public.batch_materials (batch_id, created_at desc);

alter table public.batch_materials enable row level security;
revoke all on table public.batch_materials from anon, authenticated;

create table if not exists public.teacher_content_audit (
  id           text primary key, -- "audit-…"
  teacher_id   text references public.teachers (id) on delete set null,
  teacher_name text not null,
  batch_id     text not null,
  content_type text not null check (content_type in ('class_link', 'recording', 'material', 'announcement')),
  content_id   text not null,
  action       text not null check (action in ('created', 'updated', 'deleted')),
  title        text,
  detail       text,
  created_at   timestamptz not null default now()
);

create index if not exists teacher_content_audit_teacher_idx on public.teacher_content_audit (teacher_id, created_at desc);
create index if not exists teacher_content_audit_batch_idx on public.teacher_content_audit (batch_id, created_at desc);

alter table public.teacher_content_audit enable row level security;
revoke all on table public.teacher_content_audit from anon, authenticated;

notify pgrst, 'reload schema';
