import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// POST { studentId, rupees, dueDate }: Admin → Payments' "+ Add EMI" — adds
// one pending installment to a student. It goes on the student's first
// course enrollment; a student with none gets a "Custom payment plan"
// placeholder enrollment to hang it on (EMI rows need one).
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = (await req.json().catch(() => null)) as { studentId?: unknown; rupees?: unknown; dueDate?: unknown } | null;
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const rupees = Number(body?.rupees);
  const dueDate = typeof body?.dueDate === "string" ? body.dueDate : "";
  if (!studentId) return new Response("Missing student.", { status: 400 });
  if (!Number.isFinite(rupees) || rupees <= 0 || rupees > 10_000_000) return new Response("Enter a valid amount.", { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) return new Response("Pick a due date.", { status: 400 });

  const { data: student } = await supabase.from("students").select("id, name").eq("id", studentId).maybeSingle();
  if (!student) return new Response("Student not found.", { status: 404 });

  let { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id, product_title")
    .eq("student_id", studentId)
    .order("enrolled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!enrollment) {
    const created = {
      id: `ce-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      student_id: studentId,
      lead_id: `manual-${studentId}`,
      payment_id: `manual-plan-${studentId}`,
      product_id: "manual-plan",
      product_title: "Custom payment plan",
      status: "active",
      enrolled_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("course_enrollments").insert(created);
    if (error) {
      console.error("Failed to create placeholder enrollment", studentId, error);
      return new Response("Couldn't add the EMI.", { status: 500 });
    }
    enrollment = { id: created.id, product_title: created.product_title };
  }

  const { data: existing } = await supabase.from("emi_installments").select("installment_no").eq("course_enrollment_id", enrollment.id);
  const nextNo = Math.max(0, ...(existing ?? []).map((r) => r.installment_no as number)) + 1;
  const count = Math.max(nextNo, (existing?.length ?? 0) + 1);
  const { error } = await supabase.from("emi_installments").insert({
    id: `emi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    student_id: studentId,
    course_enrollment_id: enrollment.id,
    product_title: enrollment.product_title,
    installment_no: nextNo,
    installment_count: count,
    amount: Math.round(rupees * 100),
    due_date: dueDate,
    status: "pending",
    reminders_sent: [],
  });
  if (error) {
    console.error("Failed to add EMI installment", studentId, error);
    return new Response("Couldn't add the EMI.", { status: 500 });
  }
  if (existing && existing.length > 0) await supabase.from("emi_installments").update({ installment_count: count }).eq("course_enrollment_id", enrollment.id);
  return Response.json({ ok: true });
}
