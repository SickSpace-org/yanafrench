// An enrollment inquiry captured from the public site's "Find your batch"
// form — everything Yana needs to follow up on a prospect before they're
// handed off to WhatsApp. Persisted in Supabase (see app/api/leads/*,
// lib/supabaseAdmin.ts) so she can see every inquiry from the admin panel
// even if the visitor never actually messages her.

import type { BatchCourse } from "./batchData";

export const CURRENT_LEVELS = ["New to French", "A1", "A2", "B1", "B2", "C1"] as const;
export type CurrentLevel = (typeof CURRENT_LEVELS)[number];

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  course: BatchCourse;
  batchId: string;
  batchName: string;
  // Self-reported, so Yana can gauge fit before the first message — optional
  // since a total beginner may not know how to answer.
  currentLevel?: CurrentLevel | null;
  // Anything else the visitor wants Yana to know upfront (goals, target exam
  // date, scheduling constraints, etc).
  notes?: string | null;
  createdAt: string; // ISO timestamp

  // Razorpay test-mode payment tracking (see app/api/payment/*) — a lead is
  // written as soon as the form is submitted, then patched to "paid" once
  // /api/payment/verify confirms the signature server-side. "failed" covers
  // both a declined payment and the visitor dismissing the checkout modal.
  paymentStatus?: "paid" | "pending" | "failed" | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
};

// snake_case row shape as stored in the Supabase `leads` table.
export type LeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  course: BatchCourse;
  batch_id: string;
  batch_name: string;
  current_level: string | null;
  notes: string | null;
  created_at: string;
  payment_status: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
};

export function leadFromRow(row: LeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    course: row.course,
    batchId: row.batch_id,
    batchName: row.batch_name,
    currentLevel: (row.current_level as CurrentLevel | null) ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    paymentStatus: (row.payment_status as Lead["paymentStatus"]) ?? null,
    razorpayOrderId: row.razorpay_order_id,
    razorpayPaymentId: row.razorpay_payment_id,
  };
}

export function leadToRow(lead: Lead): LeadRow {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    course: lead.course,
    batch_id: lead.batchId,
    batch_name: lead.batchName,
    current_level: lead.currentLevel ?? null,
    notes: lead.notes ?? null,
    created_at: lead.createdAt,
    payment_status: lead.paymentStatus ?? null,
    razorpay_order_id: lead.razorpayOrderId ?? null,
    razorpay_payment_id: lead.razorpayPaymentId ?? null,
  };
}
