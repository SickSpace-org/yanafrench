// One record per paid batch enrollment — split out of `students` (see
// supabase/migrations/20260915090000_create_enrollments.sql) so one person
// (one `students` row = one login) can hold more than one enrollment
// instead of the old model where a second payment under the same email
// silently failed to create a second student row.

import type { BatchCourse } from "./batchData";

export type EnrollmentStatus = "active" | "cancelled";

export type BatchEnrollment = {
  id: string;
  studentId: string;
  leadId: string;
  paymentId: string; // Razorpay order id
  course: BatchCourse;
  batchId: string;
  batchName: string;
  status: EnrollmentStatus;
  enrolledAt: string;
};

export type BatchEnrollmentRow = {
  id: string;
  student_id: string;
  lead_id: string;
  payment_id: string;
  course: BatchCourse;
  batch_id: string;
  batch_name: string;
  status: EnrollmentStatus;
  enrolled_at: string;
};

export function batchEnrollmentFromRow(row: BatchEnrollmentRow): BatchEnrollment {
  return {
    id: row.id,
    studentId: row.student_id,
    leadId: row.lead_id,
    paymentId: row.payment_id,
    course: row.course,
    batchId: row.batch_id,
    batchName: row.batch_name,
    status: row.status,
    enrolledAt: row.enrolled_at,
  };
}

export function batchEnrollmentToRow(e: BatchEnrollment): BatchEnrollmentRow {
  return {
    id: e.id,
    student_id: e.studentId,
    lead_id: e.leadId,
    payment_id: e.paymentId,
    course: e.course,
    batch_id: e.batchId,
    batch_name: e.batchName,
    status: e.status,
    enrolled_at: e.enrolledAt,
  };
}
