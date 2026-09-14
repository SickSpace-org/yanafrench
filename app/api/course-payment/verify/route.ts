import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { coursePaymentFromRow, type CoursePaymentRow } from "@/lib/coursePaymentData";
import { resolveStudentIdentity } from "@/lib/enrollment";

function newEnrollmentId(): string {
  return `enroll-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Verifies a completed Razorpay checkout server-side — mirrors
// app/api/payment/verify/route.ts's HMAC check exactly, but scoped to
// course_payments/course_leads. Unlike a batch, a course-catalog product
// has no seat/schedule concept — but it now provisions the same real
// student-hub login and a course_enrollments row, so buying from the
// Courses tab gets a student the same portal access as buying a batch does.
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

  const { data: paymentRow } = await supabase
    .from("course_payments")
    .select("*")
    .eq("id", razorpay_order_id)
    .maybeSingle();

  const { error: paymentUpdateError } = await supabase
    .from("course_payments")
    .update({ status: "paid", razorpay_payment_id, paid_at: new Date().toISOString() })
    .eq("id", razorpay_order_id);
  if (paymentUpdateError) console.error("Failed to mark course payment as paid", paymentUpdateError);

  if (leadId) {
    const { error: leadUpdateError } = await supabase
      .from("course_leads")
      .update({ payment_status: "paid", razorpay_order_id, razorpay_payment_id })
      .eq("id", leadId);
    if (leadUpdateError) console.error("Failed to mark course lead as paid", leadUpdateError);
  }

  // The enrollment needs the payment's contact/product details — if
  // create-order couldn't record it (missing fields), there's nothing
  // reliable to build one from, so this is skipped rather than guessed.
  if (paymentRow) {
    const payment = coursePaymentFromRow(paymentRow as CoursePaymentRow);

    const { data: existingEnrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("payment_id", payment.id)
      .maybeSingle();

    if (!existingEnrollment) {
      const { studentId } = await resolveStudentIdentity(supabase, {
        name: payment.name,
        email: payment.email,
        phone: payment.phone,
      });

      const { error } = await supabase.from("course_enrollments").insert({
        id: newEnrollmentId(),
        student_id: studentId,
        lead_id: leadId || payment.leadId,
        payment_id: payment.id,
        product_id: payment.productId,
        product_title: payment.productTitle,
        status: "active",
        enrolled_at: new Date().toISOString(),
      });
      if (error?.code === "23505") {
        console.warn(`[course-payment/verify] Duplicate enrollment race for payment ${payment.id} (${payment.email}, product ${payment.productId}) — already enrolled, no second row created.`);
      } else if (error) {
        console.error("Failed to insert course enrollment for payment", payment.id, error);
      }
    }
  }

  return Response.json({ verified: true });
}
