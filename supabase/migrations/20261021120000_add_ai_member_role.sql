-- AI Hub, step 1 of 2: adds 'ai_member' as a fourth allowed value of the
-- existing app_role type (today: 'admin', 'student', 'teacher'), used by
-- public.user_roles. An ai_member is someone who pays for the standalone AI
-- Hub only — they have no access to the Student Hub, Admin or Teacher areas.
--
-- Nothing else changes: no existing row, policy or function is touched, and
-- custom_access_token_hook copies the stored role into the JWT as text, so an
-- 'ai_member' row simply yields user_role = "ai_member".
--
-- Its own file because Postgres won't let a newly added enum value be used in
-- the same transaction that adds it. Run this first, then
-- 20261021120100_create_ai_hub.sql. Safe to re-run (IF NOT EXISTS).

alter type public.app_role add value if not exists 'ai_member';
