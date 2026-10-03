import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { leadFromRow, leadToRow, type Lead, type LeadRow } from "@/lib/leadData";
import { formatDays, formatTime } from "@/lib/batchData";
import { formatIndiaDate } from "@/lib/emiData";
import { sendEnrollmentReceivedEmail } from "@/lib/email";
import { readPortalState } from "@/lib/portalStateServer";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { whatsappDisplay, whatsappUrl } from "@/lib/site";

// GET: list every enrollment inquiry for Admin → Enrollments, newest first.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to list leads", error);
    return new Response("Failed to load leads.", { status: 500 });
  }
  return Response.json((data as LeadRow[]).map(leadFromRow));
}

// POST: deliberately unguarded — anonymous site visitors submit this via
// the batch enroll form (see components/BatchFinder.tsx). Saves the
// enquiry for Admin → Enrollments and emails the student a confirmation;
// payment is arranged with Yana directly and confirmed there by hand.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await checkRateLimit(`lead:${ip}`, 10, 600))) return rateLimitResponse();

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const lead = (await req.json().catch(() => null)) as Lead | null;
  if (!lead || !lead.id || !lead.name || !lead.email || !lead.phone) {
    return new Response("Invalid lead.", { status: 400 });
  }

  // Course/batch come from the live batch list, never the client's copy.
  const batch = (await readPortalState()).batches.find((b) => b.id === lead.batchId);
  if (!batch) return new Response("That batch is no longer available.", { status: 400 });
  const clean: Lead = {
    ...lead,
    name: lead.name.trim(),
    email: lead.email.trim(),
    phone: lead.phone.trim(),
    course: batch.course,
    batchName: batch.name,
    paymentStatus: "pending",
    razorpayOrderId: null,
    razorpayPaymentId: null,
    createdAt: new Date().toISOString(),
  };

  const { error } = await supabase.from("leads").insert(leadToRow(clean));
  if (error) {
    console.error("Failed to insert lead", error);
    return new Response("Failed to save lead.", { status: 500 });
  }

  // Best-effort: the enquiry is saved even if the email can't be sent.
  await sendEnrollmentReceivedEmail(clean.email, {
    name: clean.name,
    courseTitle: `${batch.course} — ${batch.name}`,
    details: [
      `Course: ${batch.course}`,
      `Batch: ${batch.name}`,
      `Schedule: ${formatDays(batch.days)} · ${formatTime(batch.start_time)}–${formatTime(batch.end_time)} (India time)`,
      ...(batch.start_date ? [`Starts: ${formatIndiaDate(batch.start_date)}`] : []),
      ...(clean.currentLevel ? [`Your level: ${clean.currentLevel}`] : []),
    ],
    whatsappUrl: whatsappUrl(`Hi Yana! I just enrolled in the ${batch.course} ${batch.name} batch on the website (${clean.email}). Could you share the next steps?`),
    whatsappNumber: whatsappDisplay,
  }).catch((err) => console.error("Failed to send enrollment email", clean.email, err));

  return Response.json({ ok: true });
}
