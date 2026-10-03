-- AI feedback on a homework submission (see lib/homeworkCheck.ts): an
-- overall summary plus a verdict, correction and explanation per task,
-- shaped like the answers. Null until checked, or if the check failed.

alter table public.homework_submissions add column if not exists feedback jsonb;

notify pgrst, 'reload schema';
