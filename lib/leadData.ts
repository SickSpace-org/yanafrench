// An enrollment inquiry captured from the public site's "Find your batch"
// form — everything Yana needs to follow up on a prospect before they're
// handed off to WhatsApp. Persisted on the shared portal state (see
// lib/portalState.ts) so she can see every inquiry from the admin panel
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
  paymentAmount?: number | null; // in paise
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
};
