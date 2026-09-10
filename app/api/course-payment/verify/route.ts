import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Verifies a completed Razorpay checkout server-side — mirrors
// app/api/payment/verify/route.ts's HMAC check exactly, but scoped to
// course_payments/course_leads. There's no seat/student side effect here:
// course-catalog products don't have a seat concept.
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
    await supabase.from("course_payments").update({ status: "failed" }).eq("id", razorpay_order_id);
    if (leadId) await supabase.from("course_leads").update({ payment_status: "failed" }).eq("id", leadId);
    return new Response("Signature verification failed.", { status: 400 });
  }

  await supabase
    .from("course_payments")
    .update({ status: "paid", razorpay_payment_id, paid_at: new Date().toISOString() })
    .eq("id", razorpay_order_id);

  if (leadId) {
    await supabase
      .from("course_leads")
      .update({ payment_status: "paid", razorpay_order_id, razorpay_payment_id })
      .eq("id", leadId);
  }

  return Response.json({ verified: true });
}
