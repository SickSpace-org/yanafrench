// Admin → Enrollments and Admin → Payments, shared shapes (client-safe).
//
// The website's two enroll forms — batch (components/EnrollModal.tsx →
// `leads`) and course (components/CourseEnrollModal.tsx → `course_leads`)
// — no longer take payment online. Each submission shows up in Admin →
// Enrollments as an EnrollmentRequest until the admin confirms the payment
// was received (lib/enrollmentRequests.ts), which records it in Admin →
// Payments and enrolls the student (Students, and EMI when on a plan).

import type { PaymentPlan } from "./emiData";

export type EnrollmentKind = "batch" | "course";

export type EnrollmentRequest = {
  id: string; // the lead id — "lead-…" (batch) or "course-lead-…" (course)
  kind: EnrollmentKind;
  name: string;
  phone: string;
  email: string;
  whatsapp: string | null;
  title: string; // "TEF" (batch) or the course title
  detail: string | null; // batch name; null for courses
  level: string | null;
  mode: string | null;
  notes: string | null;
  plan: PaymentPlan | null; // what the student picked on the form
  emiAvailable: boolean;
  feePaise: number | null; // catalog price; null for batches (no list price)
  emiUpfrontPaise: number | null;
  createdAt: string;
};

export type AdminPaymentMethod = "manual" | "razorpay";

export type AdminPayment = {
  id: string;
  kind: EnrollmentKind;
  name: string;
  email: string;
  phone: string;
  title: string;
  detail: string | null;
  plan: PaymentPlan;
  amount: number; // paise
  currency: string;
  status: "created" | "paid" | "failed";
  method: AdminPaymentMethod;
  createdAt: string;
  paidAt: string | null;
};

// Manually confirmed payments get ids with this prefix (no Razorpay order).
export const MANUAL_PAYMENT_PREFIX = "manual-";

export function enrollmentKindFromId(id: string): EnrollmentKind {
  return id.startsWith("course-lead-") ? "course" : "batch";
}
