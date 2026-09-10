import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { courseLeadToRow, type CourseLead } from "@/lib/courseLeadData";
import { findEnrollableByProductId, enrollableTitle } from "@/lib/courseCatalogData";

type CreateLeadBody = {
  name?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  productId?: string;
  currentLevel?: string;
  preferredMode?: string;
  message?: string;
};

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new Response("Supabase isn't configured.", { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateLeadBody;
  const { name, phone, email, whatsapp, productId, currentLevel, preferredMode, message } = body;

  if (!name?.trim() || !phone?.trim() || !email?.trim() || !productId) {
    return new Response("Missing required fields.", { status: 400 });
  }

  // productTitle is never trusted from the client — it's re-derived here from
  // the catalog by productId, same principle as
  // app/api/course-payment/create-order/route.ts's price re-derivation, so
  // course_leads.product_title always matches course_payments.product_title.
  const enrollable = findEnrollableByProductId(productId);
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

  const { error } = await supabase.from("course_leads").insert(courseLeadToRow(lead));
  if (error) {
    console.error("Failed to record course lead", error);
    return new Response("Failed to save enrollment.", { status: 502 });
  }

  return Response.json({ leadId: lead.id });
}
