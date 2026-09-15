// The "a payment was confirmed, now make it real" side of both payment
// flows — extracted so app/api/payment/verify (browser callback) and
// app/api/webhooks/razorpay (server-to-server) share one implementation
// instead of two parallel copies that could drift. Both triggers end up
// calling the same function for the same order; see the idempotency notes
// on each insert below for why running this twice for one payment is safe.

import type { SupabaseClient } from "@supabase/supabase-js";
import { paymentFromRow, type PaymentRow } from "./paymentData";
import { coursePaymentFromRow, type CoursePaymentRow } from "./coursePaymentData";
import { resolveStudentIdentity } from "./enrollment";
import { writeJson } from "./r2";
import { applyPortalAction, PORTAL_STATE_KEY } from "./portalState";
import { readPortalState } from "./portalStateServer";

function newEnrollmentId(): string {
  return `enroll-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Batches still live on R2 (see lib/portalState.ts) — a paid seat is taken
// the moment a payment is fulfilled, decrementing seats_remaining and
// flipping status to "full" once it hits zero so the enroll button
// disappears (see canSelect() in components/BatchFinder.tsx).
export async function decrementBatchSeat(batchId: string) {
  const state = await readPortalState();
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch || batch.seats_remaining <= 0) return;

  const nextSeats = batch.seats_remaining - 1;
  const next = applyPortalAction(state, {
    type: "updateBatch",
    id: batchId,
    patch: {
      seats_remaining: nextSeats,
      status: nextSeats <= 0 && batch.status !== "waitlist" ? "full" : batch.status,
    },
  });
  await writeJson(PORTAL_STATE_KEY, next);
}

export type FulfillResult =
  | { fulfilled: true }
  | { fulfilled: false; reason: "no-matching-payment" | "already-fulfilled" };

// Marks a batch payment paid and creates the enrollment, if it hasn't been
// already. Called from app/api/payment/verify right after the browser's
// checkout-flow signature is verified, and from the Razorpay webhook right
// after ITS (different) signature is verified — same function either way,
// so a payment confirmed by whichever trigger fires first is fulfilled
// exactly once. leadIdOverride is the browser-supplied leadId when called
// from verify (preserves exact prior behavior); the webhook has no such
// value to pass, so this falls back to the lead_id already stored on the
// payments row from create-order.
export async function fulfillBatchPayment(
  supabase: SupabaseClient,
  orderId: string,
  razorpayPaymentId: string,
  leadIdOverride?: string | null
): Promise<FulfillResult> {
  const { data: paymentRow } = await supabase.from("payments").select("*").eq("id", orderId).maybeSingle();

  await supabase
    .from("payments")
    .update({ status: "paid", razorpay_payment_id: razorpayPaymentId, paid_at: new Date().toISOString() })
    .eq("id", orderId);

  const leadId = leadIdOverride || (paymentRow as PaymentRow | null)?.lead_id || null;
  if (leadId) {
    await supabase
      .from("leads")
      .update({ payment_status: "paid", razorpay_order_id: orderId, razorpay_payment_id: razorpayPaymentId })
      .eq("id", leadId);
  }

  // The enrollment needs the payment's contact/batch details — if
  // create-order couldn't record the payment (missing fields), there's
  // nothing reliable to build one from, so this is skipped rather than
  // guessed.
  if (!paymentRow) return { fulfilled: false, reason: "no-matching-payment" };

  const payment = paymentFromRow(paymentRow as PaymentRow);

  // Guards against a duplicate enrollment if this ever runs twice for the
  // same payment (browser callback + webhook, or either one retried) —
  // payment_id is unique on batch_enrollments, so this is also enforced
  // at the DB level below.
  const { data: existingEnrollment } = await supabase
    .from("batch_enrollments")
    .select("id")
    .eq("payment_id", payment.id)
    .maybeSingle();
  if (existingEnrollment) return { fulfilled: false, reason: "already-fulfilled" };

  // Best-effort: a provisioning failure (e.g. email couldn't be sent) must
  // never fail this — the payment already succeeded. The admin can always
  // resend the setup link from Admin -> Students.
  const { studentId } = await resolveStudentIdentity(supabase, {
    name: payment.name,
    email: payment.email,
    phone: payment.phone,
  });

  const { error } = await supabase.from("batch_enrollments").insert({
    id: newEnrollmentId(),
    student_id: studentId,
    lead_id: leadId || payment.leadId,
    payment_id: payment.id,
    course: payment.course,
    batch_id: payment.batchId,
    batch_name: payment.batchName,
    status: "active",
    enrolled_at: new Date().toISOString(),
  });
  // A student who already holds this exact batch (student_id, batch_id
  // unique), or a race between the two triggers above, hits this — log it
  // distinctly so it's never confused with an unexpected DB error, and
  // never silently dropped like the old students_user_id_key bug.
  if (error?.code === "23505") {
    console.warn(`[paymentFulfillment] Duplicate enrollment race for payment ${payment.id} (${payment.email}, batch ${payment.batchId}) — already enrolled, no second row created.`);
  } else if (error) {
    console.error("Failed to insert batch enrollment for payment", payment.id, error);
  }

  // The seat was paid for regardless of whether the enrollment row above
  // was created, a duplicate, or hit an unexpected error — it must never
  // depend on that side effect succeeding.
  await decrementBatchSeat(payment.batchId);
  return { fulfilled: true };
}

// Same as fulfillBatchPayment, for course-catalog purchases. No seat
// concept, so no decrement step — otherwise identical shape.
export async function fulfillCoursePayment(
  supabase: SupabaseClient,
  orderId: string,
  razorpayPaymentId: string,
  leadIdOverride?: string | null
): Promise<FulfillResult> {
  const { data: paymentRow } = await supabase.from("course_payments").select("*").eq("id", orderId).maybeSingle();

  const { error: paymentUpdateError } = await supabase
    .from("course_payments")
    .update({ status: "paid", razorpay_payment_id: razorpayPaymentId, paid_at: new Date().toISOString() })
    .eq("id", orderId);
  if (paymentUpdateError) console.error("Failed to mark course payment as paid", paymentUpdateError);

  const leadId = leadIdOverride || (paymentRow as CoursePaymentRow | null)?.lead_id || null;
  if (leadId) {
    const { error: leadUpdateError } = await supabase
      .from("course_leads")
      .update({ payment_status: "paid", razorpay_order_id: orderId, razorpay_payment_id: razorpayPaymentId })
      .eq("id", leadId);
    if (leadUpdateError) console.error("Failed to mark course lead as paid", leadUpdateError);
  }

  if (!paymentRow) return { fulfilled: false, reason: "no-matching-payment" };

  const payment = coursePaymentFromRow(paymentRow as CoursePaymentRow);

  const { data: existingEnrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("payment_id", payment.id)
    .maybeSingle();
  if (existingEnrollment) return { fulfilled: false, reason: "already-fulfilled" };

  const { studentId } = await resolveStudentIdentity(supabase, {
    name: payment.name,
    email: payment.email,
    phone: payment.phone,
  });

  const { error } = await supabase.from("course_enrollments").insert({
    id: newEnrollmentId(),
    student_id: studentId,
    lead_id: leadId || payment.leadId,
    payment_id: payment.id,
    product_id: payment.productId,
    product_title: payment.productTitle,
    status: "active",
    enrolled_at: new Date().toISOString(),
  });
  if (error?.code === "23505") {
    console.warn(`[paymentFulfillment] Duplicate enrollment race for payment ${payment.id} (${payment.email}, product ${payment.productId}) — already enrolled, no second row created.`);
  } else if (error) {
    console.error("Failed to insert course enrollment for payment", payment.id, error);
  }

  return { fulfilled: true };
}
