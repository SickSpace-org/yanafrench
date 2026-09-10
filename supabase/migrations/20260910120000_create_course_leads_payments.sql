-- Enrollment pipeline tables for the public /courses catalog (course
-- packages, DELF skill options, orientation test levels) — isolated from
-- public.leads/payments/students, which back the batch-seat enrollment
-- system (see 20260907120000_create_leads_payments_students.sql). Matches
-- the row shapes in lib/courseLeadData.ts and lib/coursePaymentData.ts.
-- Same access model as that migration: RLS enabled with no policies, so
-- only the service-role key (lib/supabaseAdmin.ts) can reach these tables.

create table if not exists public.course_leads (
  id text primary key,
  name text not null,
  phone text not null,
  email text not null,
  whatsapp text,
  product_id text not null,
  product_title text not null,
  current_level text,
  preferred_mode text,
  message text,
  payment_status text,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);

create index if not exists course_leads_created_at_idx on public.course_leads using btree (created_at desc);

alter table public.course_leads enable row level security;

create table if not exists public.course_payments (
  id text primary key, -- Razorpay order id
  lead_id text not null,
  name text not null,
  email text not null,
  phone text not null,
  product_id text not null,
  product_title text not null,
  amount integer not null, -- paise
  currency text not null,
  status text not null,
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists course_payments_created_at_idx on public.course_payments using btree (created_at desc);

alter table public.course_payments enable row level security;

grant select, insert, update, delete on public.course_leads, public.course_payments
  to anon, authenticated;
