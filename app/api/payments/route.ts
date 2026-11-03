import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { listAdminPayments } from "@/lib/enrollmentRequests";
import { MANUAL_PAYMENT_PREFIX } from "@/lib/enrollmentRequestData";

// GET: Admin → Payments — batch and course payments together (payments
// confirmed by hand in Admin → Enrollments, plus older Razorpay ones),
// newest first. Rows are written only by the confirm flow (and, before it,
// the Razorpay checkout routes) — no public POST here.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  try {
    return Response.json(await listAdminPayments(supabase));
  } catch (error) {
    console.error("Failed to list payments", error);
    return new Response("Failed to load payments.", { status: 500 });
  }
}

// POST { studentId, rupees }: Admin → Payments, "how much has this student
// paid" for a student with no payment recorded. Writes a manual, already
// paid row and points the student's payment_id at it (no enrollment needed).
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = (await req.json().catch(() => null)) as { studentId?: unknown; rupees?: unknown } | null;
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const rupees = Number(body?.rupees);
  if (!studentId) return new Response("Missing student.", { status: 400 });
  if (!Number.isFinite(rupees) || rupees < 0 || rupees > 10_000_000) return new Response("Enter a valid amount.", { status: 400 });

  const { data: student } = await supabase.from("students").select("id, name, email, phone, payment_id").eq("id", studentId).maybeSingle();
  if (!student) return new Response("Student not found.", { status: 404 });

  const now = new Date().toISOString();
  const id = `${MANUAL_PAYMENT_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from("payments").insert({
    id,
    lead_id: `manual-${studentId}`,
    name: student.name,
    email: student.email,
    phone: student.phone ?? "",
    course: "Manual",
    batch_id: "manual",
    batch_name: "Recorded by admin",
    amount: Math.round(rupees * 100),
    currency: "INR",
    status: "paid",
    razorpay_payment_id: null,
    created_at: now,
    paid_at: now,
  });
  if (error) {
    console.error("Failed to record manual payment", studentId, error);
    return new Response("Couldn't record the payment.", { status: 500 });
  }
  const { error: linkErr } = await supabase.from("students").update({ payment_id: id }).eq("id", studentId);
  if (linkErr) {
    await supabase.from("payments").delete().eq("id", id);
    console.error("Failed to link manual payment", studentId, linkErr);
    return new Response("Couldn't record the payment.", { status: 500 });
  }
  return Response.json({ ok: true, id });
}
