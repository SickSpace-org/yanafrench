// One-off test harness: exercises the new enrollment restructuring end to
// end via real HTTP calls to the local dev server, without depending on
// Razorpay's checkout widget (which is currently stuck in test mode).
// create-order calls are real (a real, uncaptured Razorpay order — no
// money moves without a completed payment against it). verify is called
// with a signature computed the exact same way Razorpay's checkout.js
// would, using the real secret — this is a faithful simulation of "the
// browser reported a completed payment," which is all verify ever
// actually checks (it never itself calls out to Razorpay to confirm).
//
//   node --env-file=.env.local scripts/test-enrollment-flows.mjs
//
// Prints a report; does not clean up the disposable test rows it creates
// (that's a separate, explicit step after reviewing the results).

import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

const BASE = "http://localhost:3000";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (!RAZORPAY_KEY_SECRET) {
  console.error("Missing RAZORPAY_KEY_SECRET in .env.local");
  process.exit(1);
}

function fakeSignature(orderId, paymentId) {
  return createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

async function json(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

const BATCH_A = { id: "batch-1788774410407-yusjliw1dp", course: "DELF", name: "DELF B1 Batch" };
const BATCH_B = { id: "batch-1788774400780-3xspful9lps", course: "TEF", name: "TEF – Evening Batch (Late)" };
const PRODUCT_ID = "orientation-a1";

const stamp = Date.now();
const email = `multi-enroll-sim-${stamp}@example.com`;
const courseEmail = `course-enroll-sim-${stamp}@example.com`;

async function createOrder(payload) {
  const res = await fetch(`${BASE}/api/payment/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await json(res) };
}

async function verify(orderId, leadId) {
  const paymentId = `pay_sim_${Math.random().toString(36).slice(2, 11)}`;
  const signature = fakeSignature(orderId, paymentId);
  const res = await fetch(`${BASE}/api/payment/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, leadId }),
  });
  return { status: res.status, body: await json(res) };
}

async function createCourseOrder(payload) {
  const res = await fetch(`${BASE}/api/course-payment/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await json(res) };
}

async function verifyCourse(orderId, leadId) {
  const paymentId = `pay_sim_${Math.random().toString(36).slice(2, 11)}`;
  const signature = fakeSignature(orderId, paymentId);
  const res = await fetch(`${BASE}/api/course-payment/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, leadId }),
  });
  return { status: res.status, body: await json(res) };
}

async function main() {
  console.log(`Test email (batch flow): ${email}`);
  console.log(`Test email (course flow): ${courseEmail}\n`);

  // ---- 1. First batch enrollment ----
  console.log("1. Creating order for Batch A (DELF B1)...");
  const leadId1 = `lead-sim-${stamp}-a`;
  const order1 = await createOrder({ leadId: leadId1, name: "Sim Tester", email, phone: "+919876540099", course: BATCH_A.course, batchId: BATCH_A.id, batchName: BATCH_A.name });
  console.log("   create-order:", order1.status, order1.body);
  const verify1 = await verify(order1.body.orderId, leadId1);
  console.log("   verify:", verify1.status, verify1.body);

  // ---- 2. Second batch enrollment, same email, different batch ----
  console.log("\n2. Creating order for Batch B (TEF Evening Late), same email...");
  const leadId2 = `lead-sim-${stamp}-b`;
  const order2 = await createOrder({ leadId: leadId2, name: "Sim Tester", email, phone: "+919876540099", course: BATCH_B.course, batchId: BATCH_B.id, batchName: BATCH_B.name });
  console.log("   create-order:", order2.status, order2.body);
  const verify2 = await verify(order2.body.orderId, leadId2);
  console.log("   verify:", verify2.status, verify2.body);

  // ---- 3. Duplicate: same email, Batch A again ----
  console.log("\n3. Attempting Batch A again with the SAME email (should be blocked)...");
  const order3 = await createOrder({ leadId: `lead-sim-${stamp}-c`, name: "Sim Tester", email, phone: "+919876540099", course: BATCH_A.course, batchId: BATCH_A.id, batchName: BATCH_A.name });
  console.log("   create-order:", order3.status, order3.body);

  // ---- 4. Course-catalog: fresh identity ----
  console.log("\n4. Creating course-catalog order (orientation-a1) for a fresh email...");
  const courseLeadRes = await fetch(`${BASE}/api/course-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Course Sim Tester", email: courseEmail, phone: "+919876540098", productId: PRODUCT_ID }),
  });
  const courseLead = await json(courseLeadRes);
  console.log("   course-lead:", courseLeadRes.status, courseLead);
  const corder1 = await createCourseOrder({ leadId: courseLead.leadId, name: "Course Sim Tester", email: courseEmail, phone: "+919876540098", productId: PRODUCT_ID });
  console.log("   create-order:", corder1.status, corder1.body);
  const cverify1 = await verifyCourse(corder1.body.orderId, courseLead.leadId);
  console.log("   verify:", cverify1.status, cverify1.body);

  // ---- 5. Course-catalog duplicate ----
  console.log("\n5. Attempting the SAME course product again with the SAME email (should be blocked)...");
  const corder2 = await createCourseOrder({ leadId: courseLead.leadId, name: "Course Sim Tester", email: courseEmail, phone: "+919876540098", productId: PRODUCT_ID });
  console.log("   create-order:", corder2.status, corder2.body);

  // ---- DB verification ----
  console.log("\n─────────────────────────────────────────────");
  console.log("DB STATE");
  console.log("─────────────────────────────────────────────");
  const { data: student1 } = await supabase.from("students").select("*").eq("email", email).maybeSingle();
  console.log("Batch-flow student:", JSON.stringify(student1, null, 2));
  if (student1) {
    const { data: enrollments1 } = await supabase.from("batch_enrollments").select("*").eq("student_id", student1.id);
    console.log("Batch enrollments:", JSON.stringify(enrollments1, null, 2));
  }

  const { data: student2 } = await supabase.from("students").select("*").eq("email", courseEmail).maybeSingle();
  console.log("Course-flow student:", JSON.stringify(student2, null, 2));
  if (student2) {
    const { data: enrollments2 } = await supabase.from("course_enrollments").select("*").eq("student_id", student2.id);
    console.log("Course enrollments:", JSON.stringify(enrollments2, null, 2));
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
