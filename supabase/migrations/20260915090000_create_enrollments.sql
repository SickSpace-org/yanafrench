-- Splits "identity" (students) from "enrollment" (a specific paid batch or
-- course-catalog product). Previously students embedded exactly one
-- course/batch directly, and had a UNIQUE(user_id) constraint, so a second
-- payment under the same email silently failed to insert a second student
-- row (see app/api/payment/verify's pre-fix behavior). Two enrollment
-- tables, mirroring the existing leads/payments vs course_leads/
-- course_payments split, so Programs (scheduled, seat-limited batches) and
-- Courses (catalog products, no schedule) stay independent as they already
-- are everywhere else in this app.
--
-- students keeps its existing columns for this deploy (course/batch_id/
-- batch_name/lead_id/payment_id) as a safety net — they become unused once
-- the app code switches to reading from these tables, and get dropped in a
-- later migration once that's confirmed stable in production.

create table if not exists public.batch_enrollments (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  lead_id text not null,
  payment_id text not null unique,
  course text not null,
  batch_id text not null,
  batch_name text not null,
  status text not null default 'active',
  enrolled_at timestamptz not null default now()
);

create unique index if not exists batch_enrollments_student_batch_uniq
  on public.batch_enrollments (student_id, batch_id);
create index if not exists batch_enrollments_student_id_idx
  on public.batch_enrollments (student_id);
create index if not exists batch_enrollments_enrolled_at_idx
  on public.batch_enrollments using btree (enrolled_at desc);

alter table public.batch_enrollments enable row level security;

create table if not exists public.course_enrollments (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  lead_id text not null,
  payment_id text not null unique,
  product_id text not null,
  product_title text not null,
  status text not null default 'active',
  enrolled_at timestamptz not null default now()
);

create unique index if not exists course_enrollments_student_product_uniq
  on public.course_enrollments (student_id, product_id);
create index if not exists course_enrollments_student_id_idx
  on public.course_enrollments (student_id);
create index if not exists course_enrollments_enrolled_at_idx
  on public.course_enrollments using btree (enrolled_at desc);

alter table public.course_enrollments enable row level security;

grant select, insert, update, delete on public.batch_enrollments, public.course_enrollments
  to anon, authenticated;
