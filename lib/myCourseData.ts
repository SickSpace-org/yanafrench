// Student hub → My Course (app/api/student/my-course): one entry per
// active enrollment with what the student has paid so far.

import type { EmiInstallment, PaymentPlan } from "./emiData";

export type MyCourse = {
  id: string;
  kind: "course" | "batch";
  title: string; // course title, or "TEF" for a batch
  detail: string | null; // batch name
  enrolledAt: string;
  plan: PaymentPlan;
  feePaise: number | null; // catalog price; null for batches (no list price)
  paidPaise: number; // first payment + every EMI paid
  installments: EmiInstallment[];
  next: EmiInstallment | null; // next unpaid EMI
};
