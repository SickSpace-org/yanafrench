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
