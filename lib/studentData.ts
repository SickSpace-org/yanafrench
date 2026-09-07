// A confirmed, paying student — created automatically the moment a
// payment is verified as "paid" (see app/api/payment/verify), so Admin →
// Students is the roster of people who actually paid to enroll, distinct
// from Admin → Enrollments (every inquiry, paid or not) and
// Admin → Payments (every transaction attempt, including failed ones).

import type { BatchCourse } from "./batchData";

export type Student = {
  id: string;
  leadId: string;
  paymentId: string;
  name: string;
  email: string;
  phone: string;
  course: BatchCourse;
  batchId: string;
  batchName: string;
  enrolledAt: string; // ISO — when the payment was confirmed
};

// snake_case row shape as stored in the Supabase `students` table.
export type StudentRow = {
  id: string;
  lead_id: string;
  payment_id: string;
  name: string;
  email: string;
  phone: string;
  course: BatchCourse;
  batch_id: string;
  batch_name: string;
  enrolled_at: string;
};

export function studentFromRow(row: StudentRow): Student {
  return {
    id: row.id,
    leadId: row.lead_id,
    paymentId: row.payment_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    course: row.course,
    batchId: row.batch_id,
    batchName: row.batch_name,
    enrolledAt: row.enrolled_at,
  };
}

export function studentToRow(student: Student): StudentRow {
  return {
    id: student.id,
    lead_id: student.leadId,
    payment_id: student.paymentId,
    name: student.name,
    email: student.email,
    phone: student.phone,
    course: student.course,
    batch_id: student.batchId,
    batch_name: student.batchName,
    enrolled_at: student.enrolledAt,
  };
}
