import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fulfillBatchPayment, fulfillCoursePayment } from "@/lib/paymentFulfillment";

// Server-to-server confirmation from Razorpay — closes the gap where the
// browser-callback verify routes never run at all (the visitor closes the
// tab right after paying, before the checkout widget's handler fires).
// Money can be captured with nothing recorded in that case; this endpoint
// is the backstop.
//
// Authenticated by signature only (no session/admin auth applies to a
// server-to-server call) — verified against RAZORPAY_WEBHOOK_SECRET, a
// DIFFERENT secret than RAZORPAY_KEY_SECRET (used for the checkout-flow
// signature in payment/verify). Registered per Razorpay dashboard mode
// (Test/Live each have their own webhook + secret), see Settings ->
// Webhooks.
//
// Calls the exact same fulfillBatchPayment/fulfillCoursePayment functions
// app/api/payment/verify and app/api/course-payment/verify call — not a
// parallel implementation — so whichever of (browser callback, this
// webhook) fires first does the real work, and the other is a safe no-op
// (payment_id is unique on both enrollment tables).

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(signature);
  return expectedBuf.length === gotBuf.length && timingSafeEqual(expectedBuf, gotBuf);
}

type RazorpayWebhookEvent = {
  event?: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
};

export async function POST(req: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook isn't configured.", { status: 501 });
  }

  const signature = req.headers.get("x-razorpay-signature");
  // Must verify against the RAW body — re-serializing parsed JSON isn't
  // guaranteed byte-identical to what Razorpay signed.
  const rawBody = await req.text();
  if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
    return new Response("Invalid signature.", { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new Response("Supabase isn't configured.", { status: 501 });
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }

  const eventType = event.event;
  const entity = event.payload?.payment?.entity;
  const orderId = entity?.order_id;
  const paymentId = entity?.id;

  // Ack (200) anything we don't need to act on — an event outside what we
  // subscribed to, or a malformed payload, isn't an error on our end, and
  // returning non-2xx just makes Razorpay retry it indefinitely. Real
  // failures (bad signature, misconfiguration) already returned above.
  if (!orderId || !paymentId || (eventType !== "payment.captured" && eventType !== "payment.failed")) {
    return Response.json({ ok: true });
  }

  const { data: batchPayment } = await supabase.from("payments").select("id, lead_id").eq("id", orderId).maybeSingle();
  if (batchPayment) {
    if (eventType === "payment.captured") {
      await fulfillBatchPayment(supabase, orderId, paymentId, batchPayment.lead_id);
    } else {
      // Only downgrade a still-pending attempt — webhook delivery order
      // isn't guaranteed, so a failed event for an earlier attempt must
      // never overwrite a payment a later retry on the same order already
      // got marked "paid".
      const { data: updated } = await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", orderId)
        .eq("status", "created")
        .select("lead_id")
        .maybeSingle();
      if (updated?.lead_id) {
        await supabase.from("leads").update({ payment_status: "failed" }).eq("id", updated.lead_id);
      }
    }
    return Response.json({ ok: true });
  }

  const { data: coursePayment } = await supabase.from("course_payments").select("id, lead_id").eq("id", orderId).maybeSingle();
  if (coursePayment) {
    if (eventType === "payment.captured") {
      await fulfillCoursePayment(supabase, orderId, paymentId, coursePayment.lead_id);
    } else {
      const { data: updated } = await supabase
        .from("course_payments")
        .update({ status: "failed" })
        .eq("id", orderId)
        .eq("status", "created")
        .select("lead_id")
        .maybeSingle();
      if (updated?.lead_id) {
        await supabase.from("course_leads").update({ payment_status: "failed" }).eq("id", updated.lead_id);
      }
    }
    return Response.json({ ok: true });
  }

  console.warn(`[webhooks/razorpay] Received ${eventType} for unknown order ${orderId}`);
  return Response.json({ ok: true });
}
