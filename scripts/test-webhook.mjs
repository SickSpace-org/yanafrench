// One-off: exercises app/api/webhooks/razorpay's own logic — signature
// verification, event parsing, and fulfillment/idempotency — without
// depending on Razorpay's infrastructure at all. Builds a real order via
// create-order (a real, uncaptured Razorpay order — no money moves), then
// POSTs a synthetic payment.captured/payment.failed webhook body signed
// with the real RAZORPAY_WEBHOOK_SECRET, exactly as Razorpay's servers
// would sign it.
//
//   node --env-file=.env.local scripts/test-webhook.mjs
//
// Does NOT prove Razorpay's servers can reach this endpoint over the
// internet — that needs the Cloudflare tunnel + dashboard-registered
// webhook + a real payment (separate test).

import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

const BASE = "http://localhost:3000";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (!WEBHOOK_SECRET) {
  console.error("Missing RAZORPAY_WEBHOOK_SECRET in .env.local");
  process.exit(1);
}

async function json(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function webhookPayload(event, orderId, paymentId, extra = {}) {
  return JSON.stringify({
    entity: "event",
    event,
    contains: ["payment"],
    payload: { payment: { entity: { id: paymentId, order_id: orderId, status: event === "payment.captured" ? "captured" : "failed", amount: 100, currency: "INR", ...extra } } },
    created_at: Math.floor(Date.now() / 1000),
  });
}

async function postWebhook(rawBody) {
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const res = await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
    body: rawBody,
  });
  return { status: res.status, body: await json(res) };
}

const BATCH = { id: "batch-1788774410407-yusjliw1dp", course: "DELF", name: "DELF B1 Batch" };
const stamp = Date.now();
const email = `webhook-sim-${stamp}@example.com`;

async function createOrder() {
  const res = await fetch(`${BASE}/api/payment/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: `lead-webhooksim-${stamp}`,
      name: "Webhook Sim Tester",
      email,
      phone: "+919876540097",
      course: BATCH.course,
      batchId: BATCH.id,
      batchName: BATCH.name,
    }),
  });
  return { status: res.status, body: await json(res) };
}

async function main() {
  console.log(`Test email: ${email}\n`);

  console.log("1. Bad signature -> expect 400");
  const bad = await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": "not-a-real-signature" },
    body: webhookPayload("payment.captured", "order_fake", "pay_fake"),
  });
  console.log("   ->", bad.status, await json(bad));

  console.log("\n2. Unrecognized event type -> expect 200 ack, no action");
  const unrecognized = await postWebhook(webhookPayload("payment.authorized", "order_fake", "pay_fake"));
  console.log("   ->", unrecognized.status, unrecognized.body);

  console.log("\n3. payment.captured for an unknown order_id -> expect 200 ack, logged warning server-side");
  const unknownOrder = await postWebhook(webhookPayload("payment.captured", "order_does_not_exist_xyz", "pay_fake"));
  console.log("   ->", unknownOrder.status, unknownOrder.body);

  console.log("\n4. Creating a real order (batch flow)...");
  const order = await createOrder();
  console.log("   create-order:", order.status, order.body);
  const orderId = order.body.orderId;
  const paymentId = `pay_webhooksim_${Math.random().toString(36).slice(2, 11)}`;

  console.log("\n5. payment.captured webhook for this order -> expect fulfillment (enrollment created)");
  const captured = await postWebhook(webhookPayload("payment.captured", orderId, paymentId));
  console.log("   ->", captured.status, captured.body);

  console.log("\n6. SAME payment.captured webhook delivered again (Razorpay retries) -> expect safe no-op, no duplicate enrollment");
  const capturedAgain = await postWebhook(webhookPayload("payment.captured", orderId, paymentId));
  console.log("   ->", capturedAgain.status, capturedAgain.body);

  console.log("\n7. payment.failed webhook for the SAME order, arriving after capture -> expect it NOT to downgrade status to failed");
  const failedAfterCapture = await postWebhook(webhookPayload("payment.failed", orderId, `pay_stale_${Math.random().toString(36).slice(2, 8)}`));
  console.log("   ->", failedAfterCapture.status, failedAfterCapture.body);

  console.log("\n─────────────────────────────────────────────");
  console.log("DB STATE");
  console.log("─────────────────────────────────────────────");
  const { data: paymentRow } = await supabase.from("payments").select("*").eq("id", orderId).maybeSingle();
  console.log("payments row:", JSON.stringify(paymentRow, null, 2));

  const { data: student } = await supabase.from("students").select("*").eq("email", email).maybeSingle();
  console.log("student:", JSON.stringify(student, null, 2));
  if (student) {
    const { data: enrollments } = await supabase.from("batch_enrollments").select("*").eq("student_id", student.id);
    console.log(`batch_enrollments (expect exactly 1): ${enrollments.length}`, JSON.stringify(enrollments, null, 2));
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
