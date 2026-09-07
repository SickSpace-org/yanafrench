import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { paymentFromRow, type PaymentRow } from "@/lib/paymentData";
import type { Student } from "@/lib/studentData";
import { studentToRow } from "@/lib/studentData";
import { writeJson } from "@/lib/r2";
import { applyPortalAction, PORTAL_STATE_KEY } from "@/lib/portalState";
import { readPortalState } from "@/lib/portalStateServer";

// Batches still live on R2 (see lib/portalState.ts) — a paid seat is taken
// the moment a payment is verified, decrementing seats_remaining and
// flipping status to "full" once it hits zero so the enroll button
// disappears (see canSelect() in components/BatchFinder.tsx).
async function decrementBatchSeat(batchId: string) {
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

// Verifies a completed Razorpay checkout server-side (the client-side
// "handler" callback firing is not proof of payment — Razorpay's own docs
// require re-verifying the signature here). On success: patches the
// matching Payment row to "paid" and inserts a Student row, so
// Admin → Payments and Admin → Students both reflect real, server-verified
// state rather than trusting whatever the browser reports. On failure, the
// Payment is patched to "failed" and no student is created.
export async function POST(req: Request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return new Response("Razorpay isn't configured.", { status: 501 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new Response("Supabase isn't configured.", { status: 501 });
  }

  const body = (await req.json().catch(() => null)) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    leadId?: string;
  } | null;

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, leadId } = body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return new Response("Missing payment fields.", { status: 400 });
  }

  const expected = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(razorpay_signature);
  const verified = expectedBuf.length === gotBuf.length && timingSafeEqual(expectedBuf, gotBuf);

  if (!verified) {
    await supabase.from("payments").update({ status: "failed" }).eq("id", razorpay_order_id);
    if (leadId) await supabase.from("leads").update({ payment_status: "failed" }).eq("id", leadId);
    return new Response("Signature verification failed.", { status: 400 });
  }

  const { data: paymentRow } = await supabase
    .from("payments")
    .select("*")
    .eq("id", razorpay_order_id)
    .maybeSingle();

  await supabase
    .from("payments")
    .update({ status: "paid", razorpay_payment_id, paid_at: new Date().toISOString() })
    .eq("id", razorpay_order_id);

  if (leadId) {
    await supabase
      .from("leads")
      .update({ payment_status: "paid", razorpay_order_id, razorpay_payment_id })
      .eq("id", leadId);
  }

  // The student record needs the payment's contact/batch details — if
  // create-order couldn't record the payment (missing fields), there's
  // nothing reliable to build a student from, so this is skipped rather
  // than guessed.
  if (paymentRow) {
    const payment = paymentFromRow(paymentRow as PaymentRow);

    // Guards against a duplicate student if verify is ever hit twice for
    // the same payment (e.g. a retried handler callback).
    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("payment_id", payment.id)
      .maybeSingle();

    const student: Student = {
      id: `student-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      leadId: leadId || payment.leadId,
      paymentId: payment.id,
      name: payment.name,
      email: payment.email,
      phone: payment.phone,
      course: payment.course,
      batchId: payment.batchId,
      batchName: payment.batchName,
      enrolledAt: new Date().toISOString(),
    };
    if (!existing) {
      const { error } = await supabase.from("students").insert(studentToRow(student));
      if (error) console.error("Failed to insert student", error);
      else await decrementBatchSeat(payment.batchId);
    }
  }

  return Response.json({ verified: true });
}
