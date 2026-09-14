-- Follow-up to 20260915090000_create_enrollments.sql: course/batch_id/
-- batch_name/lead_id/payment_id on `students` are vestigial now that
-- enrollment data lives in batch_enrollments/course_enrollments (see
-- lib/enrollment.ts). They're kept as a safety net, not dropped yet, but a
-- brand-new student created under the new model has no single
-- course/batch/lead/payment to put in them, so the NOT NULL constraints
-- need to go or every new signup would fail to insert.

alter table public.students
  alter column lead_id drop not null,
  alter column payment_id drop not null,
  alter column course drop not null,
  alter column batch_id drop not null,
  alter column batch_name drop not null;
