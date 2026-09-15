import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fulfillBatchPayment } from "@/lib/paymentFulfillment";

// Verifies a completed Razorpay checkout server-side (the client-side
// "handler" callback firing is not proof of payment — Razorpay's own docs
// require re-verifying the signature here). On success: hands off to
// fulfillBatchPayment, the same function the Razorpay webhook calls (see
// app/api/webhooks/razorpay) — so a payment confirmed by whichever trigger
// fires first (this callback, or the webhook, if the visitor closes the
// tab before this ever runs) gets fulfilled exactly once. On signature
// failure, the Payment is patched to "failed" and nothing else happens.
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

  await fulfillBatchPayment(supabase, razorpay_order_id, razorpay_payment_id, leadId);

  return Response.json({ verified: true });
}
