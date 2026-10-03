-- The payment plan a visitor picked on the course enroll form ("full" or
-- "emi"). Payment is now confirmed by hand in Admin -> Enrollments (no
-- online checkout), so this is the student's stated preference — the admin
-- can still change it when marking the payment received.

alter table public.course_leads add column if not exists plan text;

notify pgrst, 'reload schema';
