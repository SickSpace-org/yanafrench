-- ─────────────────────────────────────────────────────────────────────────────
-- Auth setup for yanafrench — Phase 3: link students to their Supabase Auth
-- account, provisioned automatically the moment their payment is verified
-- (see app/api/payment/verify, lib/studentAccount.ts).
--
-- Apply once, the same way as db/auth-setup.sql (Supabase SQL Editor, or
-- psql "$POSTGRES_URL_NON_POOLING" -f db/phase3-student-accounts.sql).
-- Idempotent — safe to re-run.
--
-- The 3 students that existed before this system was built have no linked
-- auth user yet. This migration does NOT create accounts for them — that's
-- a separate, explicit backfill step (see lib/studentAccount.ts), run only
-- on request.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.students
  add column if not exists user_id uuid unique references auth.users (id) on delete set null;
