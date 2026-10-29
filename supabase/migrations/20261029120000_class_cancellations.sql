-- Cancelled classes (see lib/classCancellations.ts). One row per cancelled
-- class: a batch's class on one India-time date is off for everyone in it.
-- Written from Admin -> Attendance or the teacher portal's register; the
-- batch's students are emailed and the class shows as cancelled across the
-- Student Hub. A cancelled class never counts toward attendance — any
-- attendance rows for that date are kept but ignored, so restoring the
-- class (deleting the row) brings them back.
--
-- What it changes: adds ONE new table. No existing table, row, policy or
-- function is touched. Same access model as the other tables: RLS on, no
-- policies — only the service-role key (lib/supabaseAdmin.ts) reaches it.
--
-- DEPLOY ORDER: run this before (or right after) deploying the code. Until
-- it exists, reads of it log an error and treat nothing as cancelled, and
-- "Cancel class" fails with an error — nothing else breaks.
--
-- cancelled_by: 'admin' | 'teacher:<teachers.id>' (as attendance.marked_by).
--
-- Safe to re-run (IF NOT EXISTS).

create table if not exists public.class_cancellations (
  batch_id text not null,
  class_date date not null, -- calendar date in India time
  note text, -- optional message to the students, shown in the email and hub
  cancelled_by text not null,
  cancelled_at timestamptz not null default now(),
  primary key (batch_id, class_date)
);

alter table public.class_cancellations enable row level security;

notify pgrst, 'reload schema';
