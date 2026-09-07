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

// snake_case row shape as stored in the Supabase `payments` table.
export type PaymentRow = {
  id: string;
  lead_id: string;
  name: string;
  email: string;
  phone: string;
  course: BatchCourse;
  batch_id: string;
  batch_name: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  razorpay_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export function paymentFromRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    leadId: row.lead_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    course: row.course,
    batchId: row.batch_id,
    batchName: row.batch_name,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    razorpayPaymentId: row.razorpay_payment_id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export function paymentToRow(payment: Payment): PaymentRow {
  return {
    id: payment.id,
    lead_id: payment.leadId,
    name: payment.name,
    email: payment.email,
    phone: payment.phone,
    course: payment.course,
    batch_id: payment.batchId,
    batch_name: payment.batchName,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    razorpay_payment_id: payment.razorpayPaymentId ?? null,
    created_at: payment.createdAt,
    paid_at: payment.paidAt ?? null,
  };
}
