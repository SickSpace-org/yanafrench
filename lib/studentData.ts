// A confirmed, paying student's identity/login — created automatically the
// moment their first payment is verified (see lib/enrollment.ts), so
// Admin → Students is the roster of people who actually paid to enroll,
// distinct from Admin → Enrollments (every inquiry, paid or not) and
// Admin → Payments (every transaction attempt, including failed ones).
//
// This is identity ONLY — no course/batch/product embedded here. One
// person can hold several paid enrollments (see lib/batchEnrollmentData.ts
// and lib/courseEnrollmentData.ts); a Student's own enrollments are always
// fetched alongside it, never embedded in the students row itself. See
// supabase/migrations/20260915090000_create_enrollments.sql for why this
// split exists — the old single course/batchId model silently dropped a
// second enrollment under the same email.

import type { BatchEnrollment } from "./batchEnrollmentData";
import type { CourseEnrollment } from "./courseEnrollmentData";

export type Student = {
  id: string;
  name: string;
  email: string;
  phone: string;
  enrolledAt: string; // ISO — when this identity's first payment was confirmed
  // The linked Supabase Auth user (see lib/studentAccount.ts) — null for
  // the students created before this system existed, until backfilled.
  userId?: string | null;
  // Profile photo — set via Settings' "Change photo" (see
  // app/api/student/avatar). Null for most students; initials are the
  // fallback everywhere this is shown.
  avatarUrl?: string | null;
  batchEnrollments: BatchEnrollment[];
  courseEnrollments: CourseEnrollment[];
};

// snake_case row shape as stored in the Supabase `students` table. The
// table still physically has legacy course/batch_id/batch_name/lead_id/
// payment_id columns (kept as a safety net, see the enrollments migration)
// but the app no longer reads or writes them — omitted here deliberately.
export type StudentRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  enrolled_at: string;
  user_id: string | null;
  avatar_url: string | null;
};

export function studentFromRow(
  row: StudentRow,
  batchEnrollments: BatchEnrollment[] = [],
  courseEnrollments: CourseEnrollment[] = []
): Student {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    enrolledAt: row.enrolled_at,
    userId: row.user_id,
    avatarUrl: row.avatar_url,
    batchEnrollments,
    courseEnrollments,
  };
}

export function studentToRow(student: Pick<Student, "id" | "name" | "email" | "phone" | "enrolledAt" | "userId" | "avatarUrl">): StudentRow {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    phone: student.phone,
    enrolled_at: student.enrolledAt,
    user_id: student.userId ?? null,
    avatar_url: student.avatarUrl ?? null,
  };
}
