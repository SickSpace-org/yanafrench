import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { coursePaymentToRow, type CoursePayment } from "@/lib/coursePaymentData";
import { findEnrollableByProductId, enrollablePriceInPaise, enrollableTitle } from "@/lib/courseCatalogData";

type CreateOrderBody = {
  leadId?: string;
  name?: string;
  email?: string;
  phone?: string;
  productId?: string;
};

export async function POST(req: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return new Response("Razorpay isn't configured.", { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateOrderBody;
  const { leadId, name, email, phone, productId } = body;

  if (!productId) {
    return new Response("Missing productId.", { status: 400 });
  }

  // The amount is never trusted from the client — it's re-derived here from
  // the catalog by productId, same principle as
  // app/api/payment/create-order/route.ts's flat-fee comment.
  const enrollable = findEnrollableByProductId(productId);
  if (!enrollable) {
    return new Response("Unknown course.", { status: 400 });
  }
  const amount = enrollablePriceInPaise(enrollable);
  const title = enrollableTitle(enrollable);

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: leadId ? `course-lead-${leadId}` : `course-enroll-${Date.now()}`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Razorpay course order creation failed", res.status, text);
    return new Response("Failed to create payment order.", { status: 502 });
  }

  const order = await res.json();

  if (leadId && name && email && phone) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const payment: CoursePayment = {
        id: order.id,
        leadId,
        name,
        email,
        phone,
        productId,
        productTitle: title,
        amount: order.amount,
        currency: order.currency,
        status: "created",
        razorpayPaymentId: null,
        createdAt: new Date().toISOString(),
        paidAt: null,
      };
      const { error } = await supabase.from("course_payments").insert(coursePaymentToRow(payment));
      if (error) console.error("Failed to record course payment attempt", error);
    }
  }

  return Response.json({ orderId: order.id, amount: order.amount, currency: order.currency, title });
}
