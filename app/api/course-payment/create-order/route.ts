import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { coursePaymentToRow, type CoursePayment } from "@/lib/coursePaymentData";
import { hasActiveCourseEnrollment } from "@/lib/enrollment";
import { enrollableTitle } from "@/lib/courseCatalogData";
import type { PaymentPlan } from "@/lib/emiData";
import { productEmiPlan } from "@/lib/emiSettingsServer";

type CreateOrderBody = {
  leadId?: string;
  name?: string;
  email?: string;
  phone?: string;
  productId?: string;
  plan?: PaymentPlan;
};

export async function POST(req: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return new Response("Razorpay isn't configured.", { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateOrderBody;
  const { leadId, name, email, phone, productId } = body;
  const plan: PaymentPlan = body.plan === "emi" ? "emi" : "full";

  if (!productId) {
    return new Response("Missing productId.", { status: 400 });
  }

  // The amount is never trusted from the client — it's re-derived here from
  // the catalog by productId, same principle as
  // app/api/payment/create-order/route.ts's flat-fee comment.
  const product = await productEmiPlan(productId);
  if (!product) {
    return new Response("Unknown course.", { status: 400 });
  }
  const { enrollable, pricePaise: fullPrice, plan: emiPlan } = product;
  if (plan === "emi" && !emiPlan) {
    return new Response("EMI isn't available for this course.", { status: 400 });
  }
  // EMI checkout charges only the plan's first payment now; the rest are
  // scheduled when this payment is fulfilled (see
  // lib/paymentFulfillment.ts → lib/emi.ts).
  const amount = plan === "emi" && emiPlan ? emiPlan[0].amount : fullPrice;
  const title = enrollableTitle(enrollable);

  // Block before any Razorpay order exists — same rule as the Programs
  // flow's create-order: no checkout window for a product this email
  // already owns.
  if (email) {
    const supabaseForCheck = getSupabaseAdmin();
    if (supabaseForCheck && (await hasActiveCourseEnrollment(supabaseForCheck, email, productId))) {
      return new Response("You're already enrolled in this course.", { status: 409 });
    }
  }

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
        plan,
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
