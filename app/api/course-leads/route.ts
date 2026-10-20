import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { courseLeadToRow, type CourseLead } from "@/lib/courseLeadData";
import { enrollableTitle, enrollablePriceInPaise } from "@/lib/courseCatalogData";
import { findEnrollable } from "@/lib/courseCatalogServer";
import { describeEmiPlan } from "@/lib/emiData";
import { productEmiPlan } from "@/lib/emiSettingsServer";
import { formatRupees } from "@/lib/formatCurrency";
import { after } from "next/server";
import { sendEnrollmentReceivedEmail, sendNewEnrollmentAdminEmail } from "@/lib/email";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { SITE_URL, whatsappDisplay, whatsappUrl } from "@/lib/site";

type CreateLeadBody = {
  name?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  productId?: string;
  currentLevel?: string;
  preferredMode?: string;
  message?: string;
  plan?: string;
};

// POST: deliberately unguarded — anonymous visitors submit the course
// enroll form (components/CourseEnrollModal.tsx). Saves the enquiry for
// Admin → Enrollments and emails the student a confirmation; payment is
// arranged with Yana directly and confirmed there by hand.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await checkRateLimit(`course-lead:${ip}`, 10, 600))) return rateLimitResponse();

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new Response("Supabase isn't configured.", { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateLeadBody;
  const { name, phone, email, whatsapp, productId, currentLevel, preferredMode, message } = body;
  const plan = body.plan === "emi" ? "emi" : "full";

  if (!name?.trim() || !phone?.trim() || !email?.trim() || !productId) {
    return new Response("Missing required fields.", { status: 400 });
  }

  // productTitle is never trusted from the client — it's re-derived here from
  // the catalog by productId, same principle as
  // app/api/course-payment/create-order/route.ts's price re-derivation, so
  // course_leads.product_title always matches course_payments.product_title.
  const enrollable = await findEnrollable(productId);
  if (!enrollable) {
    return new Response("Unknown course.", { status: 400 });
  }
  const productTitle = enrollableTitle(enrollable);

  const lead: CourseLead = {
    id: `course-lead-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
    whatsapp: whatsapp?.trim() || null,
    productId,
    productTitle,
    currentLevel: (currentLevel as CourseLead["currentLevel"]) || null,
    preferredMode: (preferredMode as CourseLead["preferredMode"]) || null,
    message: message?.trim() || null,
    createdAt: new Date().toISOString(),
    paymentStatus: null,
    razorpayOrderId: null,
    razorpayPaymentId: null,
  };

  const emi = (await productEmiPlan(productId))?.plan ?? null;
  const emiPlan = plan === "emi" && emi !== null;
  let { error } = await supabase.from("course_leads").insert({ ...courseLeadToRow(lead), plan: emiPlan ? "emi" : "full" });
  // Before migration 20261003150000 adds course_leads.plan, save without it
  // rather than lose the enquiry.
  if (error?.code === "PGRST204") ({ error } = await supabase.from("course_leads").insert(courseLeadToRow(lead)));
  if (error) {
    console.error("Failed to record course lead", error);
    return new Response("Failed to save enrollment.", { status: 502 });
  }

  // Best-effort: the enquiry is saved even if the email can't be sent.
  const fee = enrollablePriceInPaise(enrollable);
  const emiDescription = emi ? describeEmiPlan(emi) : "";
  await sendEnrollmentReceivedEmail(lead.email, {
    name: lead.name,
    courseTitle: productTitle,
    details: [
      `Course: ${productTitle}`,
      `Course fee: ${formatRupees(fee)}`,
      emiPlan
        ? `Payment plan: EMI — ${emiDescription}`
        : "Payment plan: Pay in full",
      ...(lead.currentLevel ? [`Your level: ${lead.currentLevel}`] : []),
    ],
    whatsappUrl: whatsappUrl(`Hi Yana! I just enrolled in ${productTitle} on the website (${lead.email}). Could you share the next steps?`),
    whatsappNumber: whatsappDisplay,
  }).catch((err) => console.error("Failed to send enrollment email", lead.email, err));

  after(() =>
    sendNewEnrollmentAdminEmail({
      what: "course enrollment",
      studentName: lead.name,
      rows: [
        ["Course", productTitle],
        ["Course fee", formatRupees(fee)],
        ["Payment plan", emiPlan ? `EMI — ${emiDescription}` : "Pay in full"],
        ["Name", lead.name],
        ["Phone", lead.phone],
        ["WhatsApp", lead.whatsapp ?? ""],
        ["Email", lead.email],
        ["Current level", lead.currentLevel ?? ""],
        ["Preferred mode", lead.preferredMode ?? ""],
        ["Message", lead.message ?? ""],
      ],
      adminUrl: `${SITE_URL}/admin/enrollments`,
    }).catch((err) => console.error("Failed to send admin enrollment email", err))
  );

  return Response.json({ leadId: lead.id });
}
