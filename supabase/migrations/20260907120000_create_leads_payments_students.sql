-- Enrollment pipeline tables backing the admin portal's Enrollments (leads),
-- Payments, and Students sections. Matches the row shapes in lib/leadData.ts,
-- lib/paymentData.ts, and lib/studentData.ts.
--
-- This migration documents the schema already live in production (created
-- ad hoc alongside the R2-to-Supabase move) so it is version-controlled and
-- reproducible in a fresh project. All three tables are reachable only via
-- the service-role key in lib/supabaseAdmin.ts: RLS is enabled with no
-- policies, so anon/authenticated access is denied outright regardless of
-- the GRANTs below (kept for Data API exposure only).

create table if not exists public.leads (
  id text primary key,
  name text not null,
  phone text not null,
  email text not null,
  course text not null,
  batch_id text not null,
  batch_name text not null,
  current_level text,
  notes text,
  payment_status text,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads using btree (created_at desc);

alter table public.leads enable row level security;

create table if not exists public.payments (
  id text primary key, -- Razorpay order id
  lead_id text not null,
  name text not null,
  email text not null,
  phone text not null,
  course text not null,
  batch_id text not null,
  batch_name text not null,
  amount integer not null, -- paise
  currency text not null,
  status text not null,
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payments_created_at_idx on public.payments using btree (created_at desc);

alter table public.payments enable row level security;

create table if not exists public.students (
  id text primary key,
  lead_id text not null,
  payment_id text not null,
  name text not null,
  email text not null,
  phone text not null,
  course text not null,
  batch_id text not null,
  batch_name text not null,
  enrolled_at timestamptz not null default now()
);

create index if not exists students_enrolled_at_idx on public.students using btree (enrolled_at desc);

alter table public.students enable row level security;

grant select, insert, update, delete on public.leads, public.payments, public.students
  to anon, authenticated;
