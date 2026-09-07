import { createHmac, timingSafeEqual } from "crypto";
import { writeJson } from "@/lib/r2";
import { applyPortalAction, PORTAL_STATE_KEY } from "@/lib/portalState";
import { readPortalState } from "@/lib/portalStateServer";

// Verifies a completed Razorpay checkout server-side (the client-side
// "handler" callback firing is not proof of payment — Razorpay's own docs
// require re-verifying the signature here) and, if valid, marks the
// matching lead paid so Admin → Enrollments reflects real payment status
// rather than trusting whatever the browser reports.
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

  if (!verified) {
    if (leadId) {
      const existing = await readPortalState();
      const next = applyPortalAction(existing, { type: "updateLead", id: leadId, patch: { paymentStatus: "failed" } });
      await writeJson(PORTAL_STATE_KEY, next);
    }
    return new Response("Signature verification failed.", { status: 400 });
  }

  if (leadId) {
    const existing = await readPortalState();
    const next = applyPortalAction(existing, {
      type: "updateLead",
      id: leadId,
      patch: {
        paymentStatus: "paid",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      },
    });
    await writeJson(PORTAL_STATE_KEY, next);
  }

  return Response.json({ verified: true });
}
