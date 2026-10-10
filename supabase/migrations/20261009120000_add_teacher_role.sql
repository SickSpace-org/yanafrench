-- Teacher Portal, step 1 of 2: adds 'teacher' as a third allowed value of
-- the existing app_role type (today: 'admin', 'student'), used by
-- public.user_roles.
--
-- What it changes: one existing type gets one new allowed value. Nothing
-- else. No existing row changes, no admin or student loses or gains
-- anything, and custom_access_token_hook needs no change — it copies
-- whatever role is stored into the JWT's user_role claim as text, so a
-- 'teacher' row simply produces user_role = "teacher".
--
-- Why its own file: Postgres won't let a newly added enum value be USED in
-- the same transaction that adds it, and the SQL editor runs a pasted
-- script as one transaction. Run this file first, then
-- 20261009120100_create_teachers.sql.
--
-- Safe to re-run (IF NOT EXISTS). Note: an enum value can't be removed
-- again without recreating the type — harmless if left unused.

alter type public.app_role add value if not exists 'teacher';
