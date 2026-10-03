// Server side of Admin → Enrollments / Payments (shapes and the overall
// flow in lib/enrollmentRequestData.ts). Service-role client only.

import type { SupabaseClient } from "@supabase/supabase-js";
import { leadFromRow, type LeadRow } from "./leadData";
import { courseLeadFromRow, type CourseLeadRow } from "./courseLeadData";
import { paymentFromRow, type PaymentRow } from "./paymentData";
import { coursePaymentFromRow, type CoursePaymentRow } from "./coursePaymentData";
import { enrollablePriceInPaise, findEnrollableByProductId } from "./courseCatalogData";
import { emiAvailableFor, splitEmi, type PaymentPlan } from "./emiData";
import { fulfillBatchPayment, fulfillCoursePayment } from "./paymentFulfillment";
import {
  enrollmentKindFromId,
  MANUAL_PAYMENT_PREFIX,
  type AdminPayment,
  type EnrollmentRequest,
} from "./enrollmentRequestData";

// Every form submission not yet marked paid, newest first.
export async function listEnrollmentRequests(supabase: SupabaseClient): Promise<EnrollmentRequest[]> {
  const [{ data: leadRows, error: leadErr }, { data: courseRows, error: courseErr }] = await Promise.all([
    supabase.from("leads").select("*").or("payment_status.is.null,payment_status.neq.paid"),
    supabase.from("course_leads").select("*").or("payment_status.is.null,payment_status.neq.paid"),
  ]);
  if (leadErr) throw leadErr;
  if (courseErr) throw courseErr;

  const batch: EnrollmentRequest[] = ((leadRows as LeadRow[]) ?? []).map((row) => {
    const lead = leadFromRow(row);
    return {
      id: lead.id,
      kind: "batch",
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      whatsapp: null,
      title: lead.course,
      detail: lead.batchName,
      level: lead.currentLevel ?? null,
      mode: null,
      notes: lead.notes ?? null,
      plan: null,
      emiAvailable: false,
      feePaise: null,
      emiUpfrontPaise: null,
      createdAt: lead.createdAt,
    };
  });

  const course: EnrollmentRequest[] = ((courseRows as (CourseLeadRow & { plan?: string | null })[]) ?? []).map((row) => {
    const lead = courseLeadFromRow(row);
    const enrollable = findEnrollableByProductId(lead.productId);
    const fee = enrollable ? enrollablePriceInPaise(enrollable) : null;
    const emiAvailable = !!enrollable && emiAvailableFor(enrollable);
    return {
      id: lead.id,
      kind: "course",
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      whatsapp: lead.whatsapp ?? null,
      title: lead.productTitle,
      detail: null,
      level: lead.currentLevel ?? null,
      mode: lead.preferredMode ?? null,
      notes: lead.message ?? null,
      plan: row.plan === "emi" && emiAvailable ? "emi" : row.plan === "full" ? "full" : null,
      emiAvailable,
      feePaise: fee,
      emiUpfrontPaise: fee !== null && emiAvailable ? splitEmi(fee).upfront : null,
      createdAt: lead.createdAt,
    };
  });

  return [...batch, ...course].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteEnrollmentRequest(supabase: SupabaseClient, id: string) {
  const table = enrollmentKindFromId(id) === "course" ? "course_leads" : "leads";
  return supabase.from(table).delete().eq("id", id);
}

export class ConfirmError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Admin → Enrollments' "Payment received": records the payment (as a
// manual payment in `payments` / `course_payments`) and runs the same
// fulfillment a Razorpay payment used to — student record + login email,
// the enrollment, a batch seat, and the EMI schedule when plan is "emi".
export async function confirmEnrollmentPayment(
  supabase: SupabaseClient,
  leadId: string,
  input: { amountPaise: number; plan: PaymentPlan }
): Promise<void> {
  const id = `${MANUAL_PAYMENT_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  if (enrollmentKindFromId(leadId) === "course") {
    const { data: row } = await supabase.from("course_leads").select("*").eq("id", leadId).maybeSingle();
    if (!row) throw new ConfirmError(404, "Enrollment not found.");
    const lead = courseLeadFromRow(row as CourseLeadRow);
    if (lead.paymentStatus === "paid") throw new ConfirmError(409, "This payment is already confirmed.");
    const enrollable = findEnrollableByProductId(lead.productId);
    const plan: PaymentPlan = input.plan === "emi" && enrollable && emiAvailableFor(enrollable) ? "emi" : "full";

    const { error } = await supabase.from("course_payments").insert({
      id,
      lead_id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      product_id: lead.productId,
      product_title: lead.productTitle,
      amount: input.amountPaise,
      currency: "INR",
      status: "created",
      plan,
      razorpay_payment_id: null,
      created_at: now,
      paid_at: null,
    });
    if (error) {
      console.error("Failed to record manual course payment", leadId, error);
      throw new ConfirmError(500, "Couldn't record the payment.");
    }
    await fulfillCoursePayment(supabase, id, null, lead.id);
    return;
  }

  const { data: row } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!row) throw new ConfirmError(404, "Enrollment not found.");
  const lead = leadFromRow(row as LeadRow);
  if (lead.paymentStatus === "paid") throw new ConfirmError(409, "This payment is already confirmed.");

  const { error } = await supabase.from("payments").insert({
    id,
    lead_id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    course: lead.course,
    batch_id: lead.batchId,
    batch_name: lead.batchName,
    amount: input.amountPaise,
    currency: "INR",
    status: "created",
    razorpay_payment_id: null,
    created_at: now,
    paid_at: null,
  });
  if (error) {
    console.error("Failed to record manual batch payment", leadId, error);
    throw new ConfirmError(500, "Couldn't record the payment.");
  }
  await fulfillBatchPayment(supabase, id, null, lead.id);
}

// Admin → Payments: batch and course payments together, newest first.
export async function listAdminPayments(supabase: SupabaseClient): Promise<AdminPayment[]> {
  const [{ data: batchRows, error: batchErr }, { data: courseRows, error: courseErr }] = await Promise.all([
    supabase.from("payments").select("*"),
    supabase.from("course_payments").select("*"),
  ]);
  if (batchErr) throw batchErr;
  if (courseErr) throw courseErr;

  const method = (id: string) => (id.startsWith(MANUAL_PAYMENT_PREFIX) ? "manual" : "razorpay") as AdminPayment["method"];
  const batch: AdminPayment[] = ((batchRows as PaymentRow[]) ?? []).map((row) => {
    const p = paymentFromRow(row);
    return {
      id: p.id,
      kind: "batch",
      name: p.name,
      email: p.email,
      phone: p.phone,
      title: p.course,
      detail: p.batchName,
      plan: "full",
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      method: method(p.id),
      createdAt: p.createdAt,
      paidAt: p.paidAt ?? null,
    };
  });
  const course: AdminPayment[] = ((courseRows as CoursePaymentRow[]) ?? []).map((row) => {
    const p = coursePaymentFromRow(row);
    return {
      id: p.id,
      kind: "course",
      name: p.name,
      email: p.email,
      phone: p.phone,
      title: p.productTitle,
      detail: null,
      plan: p.plan,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      method: method(p.id),
      createdAt: p.createdAt,
      paidAt: p.paidAt ?? null,
    };
  });
  return [...batch, ...course].sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt));
}
