-- EMI ("pay in parts") for course-catalog purchases: 30% upfront at
-- checkout (a normal course_payments row, plan = 'emi'), then 3 monthly
-- installments covering the remaining 70%. One emi_installments row per
-- installment, created by lib/paymentFulfillment.ts the moment the upfront
-- payment is fulfilled. Each attempt to pay an installment is its own
-- Razorpay order, recorded in emi_payments (so a retried order never
-- clobbers an earlier one that might still be captured later).
-- Same access model as the other payment tables: RLS on, no policies —
-- only the service-role key (lib/supabaseAdmin.ts) reaches them.

alter table public.course_payments
  add column if not exists plan text not null default 'full';

create table if not exists public.emi_installments (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  course_enrollment_id text not null references public.course_enrollments(id) on delete cascade,
  product_title text not null,
  installment_no integer not null, -- 1..3
  installment_count integer not null,
  amount integer not null, -- paise
  due_date date not null, -- calendar date in India time
  status text not null default 'pending', -- pending | paid
  paid_at timestamptz,
  -- Reminder emails already sent for this installment ('pre5', 'due',
  -- 'grace1'..'grace5', 'locked') — keeps the daily cron idempotent.
  reminders_sent text[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists emi_installments_enrollment_no_uniq
  on public.emi_installments (course_enrollment_id, installment_no);
create index if not exists emi_installments_student_idx
  on public.emi_installments (student_id);
create index if not exists emi_installments_pending_due_idx
  on public.emi_installments (due_date) where status = 'pending';

alter table public.emi_installments enable row level security;

create table if not exists public.emi_payments (
  id text primary key, -- Razorpay order id
  installment_id text not null references public.emi_installments(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  amount integer not null,
  status text not null default 'created', -- created | paid | failed
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists emi_payments_installment_idx on public.emi_payments (installment_id);

alter table public.emi_payments enable row level security;

grant select, insert, update, delete on public.emi_installments, public.emi_payments
  to anon, authenticated;
