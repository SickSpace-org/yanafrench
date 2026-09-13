-- Profile photo support for the Settings page's "Change photo" (see
-- app/api/student/avatar, app/api/student/me PATCH). Nullable — most
-- students won't set one, initials remain the fallback everywhere.

alter table public.students
  add column if not exists avatar_url text;
