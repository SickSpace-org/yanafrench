-- Teacher Portal, Phase 3: records WHO marked an attendance cell by hand.
--
-- What it changes: adds ONE nullable column to the existing, live
-- public.attendance table. No existing row is modified (every current row
-- simply has marked_by = null), no constraint, index, policy or function
-- changes, and RLS stays on with no policies.
--
-- Effect on current users: none. Students' auto-marking on "Join class"
-- doesn't write this column. Admin -> Attendance starts writing 'admin' once
-- the new code is deployed.
--
-- DEPLOY ORDER: run this BEFORE deploying the Teacher Portal code. The new
-- code writes marked_by on every manual mark, so without the column admin
-- attendance saves would fail.
--
-- Values: 'admin'            — marked by Yana in Admin -> Attendance
--         'teacher:<id>'     — marked by that teacher (teachers.id); kept as
--                              plain text so history survives the teacher
--                              being removed
--         null               — automatic "Join class" mark, or marked
--                              before this column existed
--
-- Safe to re-run (IF NOT EXISTS).

alter table public.attendance add column if not exists marked_by text;

notify pgrst, 'reload schema';
