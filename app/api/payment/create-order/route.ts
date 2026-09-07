import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { paymentToRow, type Payment } from "@/lib/paymentData";
import type { BatchCourse } from "@/lib/batchData";

// Creates a Razorpay order server-side so the amount is never trusted from
// the client. Flat ₹1 test price for every batch right now — see the
// comment on ENROLLMENT_FEE_LABEL in components/EnrollModal.tsx, which
// displays the same figure to the visitor before checkout opens.
const ENROLLMENT_FEE_PAISE = 100; // ₹1

type CreateOrderBody = {
  leadId?: string;
  name?: string;
  email?: string;
  phone?: string;
  course?: BatchCourse;
  batchId?: string;
  batchName?: string;
};

export async function POST(req: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return new Response("Razorpay isn't configured.", { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateOrderBody;
  const { leadId, name, email, phone, course, batchId, batchName } = body;

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: ENROLLMENT_FEE_PAISE,
      currency: "INR",
      receipt: leadId ? `lead-${leadId}` : `enroll-${Date.now()}`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Razorpay order creation failed", res.status, text);
    return new Response("Failed to create payment order.", { status: 502 });
  }

  const order = await res.json();

  // Record the attempt immediately (status "created") so Admin → Payments
  // shows it even if the visitor never completes checkout — verify only
  // ever patches this record, it never creates it.
  if (leadId && name && email && phone && course && batchId && batchName) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const payment: Payment = {
        id: order.id,
        leadId,
        name,
        email,
        phone,
        course,
        batchId,
        batchName,
        amount: order.amount,
        currency: order.currency,
        status: "created",
        razorpayPaymentId: null,
        createdAt: new Date().toISOString(),
        paidAt: null,
      };
      const { error } = await supabase.from("payments").insert(paymentToRow(payment));
      if (error) console.error("Failed to record payment attempt", error);
    }
  }

  return Response.json({ orderId: order.id, amount: order.amount, currency: order.currency });
}
