import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent } from "@/lib/auth";
import { fulfillEmiPayment } from "@/lib/emi";

// Browser-callback confirmation of an EMI payment — same HMAC check as
// app/api/course-payment/verify. The Razorpay webhook is the backstop if
// this never runs (see app/api/webhooks/razorpay).
export async function POST(req: Request) {
  try {
    await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return new Response("Razorpay isn't configured.", { status: 501 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = (await req.json().catch(() => null)) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  } | null;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return new Response("Missing payment fields.", { status: 400 });
  }

  const expected = Buffer.from(createHmac("sha256", keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex"));
  const got = Buffer.from(razorpay_signature);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    await supabase.from("emi_payments").update({ status: "failed" }).eq("id", razorpay_order_id).eq("status", "created");
    return new Response("Signature verification failed.", { status: 400 });
  }

  await fulfillEmiPayment(supabase, razorpay_order_id, razorpay_payment_id);
  return Response.json({ verified: true });
}
