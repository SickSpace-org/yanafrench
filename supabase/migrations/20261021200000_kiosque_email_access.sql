-- Le Kiosque switches from password logins to email-only access: a member
-- is identified by their ai_hub_members row (matched by the email they type),
-- not by a Supabase Auth user. So the per-member tables are re-keyed:
--   user_id  uuid referencing auth.users  ->  text owner key
-- The owner key is the member's id ("aim-…"), or "admin-<uuid>" for an admin
-- previewing the hub. Existing rows (if any) keep their old uuid text and are
-- simply no longer reachable by a member.
-- Safe to re-run.

alter table public.ai_hub_words         drop constraint if exists ai_hub_words_user_id_fkey;
alter table public.ai_hub_quizzes       drop constraint if exists ai_hub_quizzes_user_id_fkey;
alter table public.ai_hub_pronunciations drop constraint if exists ai_hub_pronunciations_user_id_fkey;

alter table public.ai_hub_words          alter column user_id type text using user_id::text;
alter table public.ai_hub_quizzes        alter column user_id type text using user_id::text;
alter table public.ai_hub_pronunciations alter column user_id type text using user_id::text;
