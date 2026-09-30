import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { fetchStudentInstallments } from "@/lib/emi";
import { nextPendingInstallment } from "@/lib/emiData";

// "Pay next EMI" from the student hub (dashboard card or the locked
// pay-now page). Always charges the signed-in student's earliest unpaid
// installment — the amount and installment come from the database, never
// from the client. Each attempt is its own emi_payments row keyed by the
// Razorpay order id, so a retry never overwrites an earlier attempt.
export async function POST() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }
  if (viewer.role === "admin") {
    return new Response("Admin preview has no EMIs to pay.", { status: 400 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return new Response("Razorpay isn't configured.", { status: 501 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { data: student } = await supabase.from("students").select("id, name, email, phone").eq("user_id", viewer.userId).maybeSingle();
  if (!student) return new Response("No student record is linked to this account yet.", { status: 404 });

  const next = nextPendingInstallment(await fetchStudentInstallments(supabase, student.id));
  if (!next) return new Response("You have no EMI due.", { status: 409 });

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: next.amount,
      currency: "INR",
      receipt: `emi-${next.id}`.slice(0, 40),
      notes: { kind: "emi", installment_id: next.id },
    }),
  });
  if (!res.ok) {
    console.error("Razorpay EMI order creation failed", res.status, await res.text().catch(() => ""));
    return new Response("Failed to create payment order.", { status: 502 });
  }
  const order = await res.json();

  const { error } = await supabase.from("emi_payments").insert({
    id: order.id,
    installment_id: next.id,
    student_id: student.id,
    amount: order.amount,
    status: "created",
  });
  if (error) {
    console.error("Failed to record EMI payment attempt", error);
    return new Response("Failed to start the payment.", { status: 500 });
  }

  return Response.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    title: `${next.productTitle} — EMI ${next.installmentNo} of ${next.installmentCount}`,
    prefill: { name: student.name, email: student.email, contact: student.phone },
  });
}
