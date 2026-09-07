// A payment transaction ledger — one record per Razorpay order created
// from the enroll form (see app/api/payment/create-order), independent of
// the Lead it came from. Created as "created" when the order is opened,
// then patched to "paid" or "failed" by app/api/payment/verify once
// Razorpay's signature is confirmed server-side. This is what Admin →
// Payments reads, so every attempt — not just successful ones — is
// visible with full contact + amount detail.

import type { BatchCourse } from "./batchData";

export type PaymentStatus = "created" | "paid" | "failed";

export type Payment = {
  id: string; // Razorpay order id — naturally unique per attempt
  leadId: string;
  name: string;
  email: string;
  phone: string;
  course: BatchCourse;
  batchId: string;
  batchName: string;
  amount: number; // paise
  currency: string;
  status: PaymentStatus;
  razorpayPaymentId?: string | null;
  createdAt: string; // ISO — order creation time
  paidAt?: string | null; // ISO — set once verified paid
};
