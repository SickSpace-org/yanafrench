import { createHmac, timingSafeEqual } from "crypto";
import { writeJson } from "@/lib/r2";
import { applyPortalAction, PORTAL_STATE_KEY } from "@/lib/portalState";
import { readPortalState } from "@/lib/portalStateServer";
import type { Student } from "@/lib/studentData";

// Verifies a completed Razorpay checkout server-side (the client-side
// "handler" callback firing is not proof of payment — Razorpay's own docs
// require re-verifying the signature here). On success: patches the
// matching Payment record to "paid" and creates a Student record, so
// Admin → Payments and Admin → Students both reflect real, server-verified
// state rather than trusting whatever the browser reports. On failure, the
// Payment is patched to "failed" and no student is created.
export async function POST(req: Request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return new Response("Razorpay isn't configured.", { status: 501 });
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

  let state = await readPortalState();

  if (!verified) {
    state = applyPortalAction(state, { type: "updatePayment", id: razorpay_order_id, patch: { status: "failed" } });
    if (leadId) {
      state = applyPortalAction(state, { type: "updateLead", id: leadId, patch: { paymentStatus: "failed" } });
    }
    await writeJson(PORTAL_STATE_KEY, state);
    return new Response("Signature verification failed.", { status: 400 });
  }

  const payment = state.payments.find((p) => p.id === razorpay_order_id);

  state = applyPortalAction(state, {
    type: "updatePayment",
    id: razorpay_order_id,
    patch: {
      status: "paid",
      razorpayPaymentId: razorpay_payment_id,
      paidAt: new Date().toISOString(),
    },
  });

  if (leadId) {
    state = applyPortalAction(state, {
      type: "updateLead",
      id: leadId,
      patch: { paymentStatus: "paid", razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id },
    });
  }

  // The student record needs the payment's contact/batch details — if
  // create-order couldn't record the payment (missing fields), there's
  // nothing reliable to build a student from, so this is skipped rather
  // than guessed.
  if (payment) {
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
    state = applyPortalAction(state, { type: "addStudent", student });
  }

  await writeJson(PORTAL_STATE_KEY, state);
  return Response.json({ verified: true });
}
