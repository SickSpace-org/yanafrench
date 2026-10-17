import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { EMI_MAX_PAYMENTS, type EmiInstallmentRow } from "@/lib/emiData";

type PendingInput = { id?: unknown; amountRupees?: unknown; dueDate?: unknown };

// A Razorpay order for an installment this recent may still be paid, so
// its installment mustn't be replaced underneath it.
const IN_FLIGHT_MS = 30 * 60_000;

// Admin → EMI's "Edit plan" for one existing student's course enrollment.
// POST { pending: [{ id?, amountRupees, dueDate }] } replaces every unpaid
// installment with this list (more, fewer, or none — paid ones are never
// touched), renumbering them after the paid ones so the student sees
// "EMI 3 of 5" etc. An item that keeps an existing installment's id and
// due date keeps the reminders already sent for it. The student's hub
// lock follows the new dates straight away (lib/emi.ts isStudentHubLocked).
export async function POST(req: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { enrollmentId } = await params;
  const body = (await req.json().catch(() => null)) as { pending?: unknown } | null;
  if (!body || !Array.isArray(body.pending) || body.pending.length > EMI_MAX_PAYMENTS) {
    return new Response("Invalid plan.", { status: 400 });
  }
  const pending = (body.pending as PendingInput[]).map((p) => ({
    id: typeof p.id === "string" ? p.id : null,
    amountRupees: Number(p.amountRupees),
    dueDate: typeof p.dueDate === "string" ? p.dueDate : "",
  }));
  for (const [i, p] of pending.entries()) {
    if (!Number.isInteger(p.amountRupees) || p.amountRupees < 1) return new Response(`Payment ${i + 1} needs an amount of at least ₹1.`, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) || Number.isNaN(Date.parse(p.dueDate))) return new Response(`Payment ${i + 1} needs a valid due date.`, { status: 400 });
    if (i > 0 && p.dueDate < pending[i - 1].dueDate) return new Response(`Payment ${i + 1} can't be due before payment ${i}.`, { status: 400 });
  }

  const { data, error: loadErr } = await supabase.from("emi_installments").select("*").eq("course_enrollment_id", enrollmentId);
  if (loadErr) {
    console.error("Failed to load EMI plan", enrollmentId, loadErr);
    return new Response("Couldn't load this plan.", { status: 500 });
  }
  const rows = (data as EmiInstallmentRow[]) ?? [];
  if (rows.length === 0) return new Response("Plan not found.", { status: 404 });

  const paid = rows.filter((r) => r.status === "paid");
  const oldPending = rows.filter((r) => r.status === "pending");

  if (oldPending.length > 0) {
    const { data: orders } = await supabase
      .from("emi_payments")
      .select("id, created_at")
      .in("installment_id", oldPending.map((r) => r.id))
      .eq("status", "created");
    if ((orders ?? []).some((o) => Date.now() - Date.parse(o.created_at) < IN_FLIGHT_MS)) {
      return new Response("The student started paying an installment in the last 30 minutes — try again a little later.", { status: 409 });
    }
  }

  // Numbering: the plan's upfront payment is #1 on new-style plans (rows
  // start at 2); older plans started at 1. Unpaid ones follow the paid ones.
  const firstNo = Math.min(...rows.map((r) => r.installment_no));
  const startNo = paid.length > 0 ? Math.max(...paid.map((r) => r.installment_no)) + 1 : firstNo;
  const count = pending.length > 0 ? startNo + pending.length - 1 : Math.max(startNo - 1, ...paid.map((r) => r.installment_no));
  const template = rows[0];
  const oldById = new Map(oldPending.map((r) => [r.id, r]));

  const newRows = pending.map((p, i) => {
    const no = startNo + i;
    const old = p.id ? oldById.get(p.id) : undefined;
    return {
      id: `emi-${enrollmentId}-${no}`,
      student_id: template.student_id,
      course_enrollment_id: enrollmentId,
      product_title: template.product_title,
      installment_no: no,
      installment_count: count,
      amount: p.amountRupees * 100,
      due_date: p.dueDate,
      status: "pending",
      reminders_sent: old && old.due_date === p.dueDate ? old.reminders_sent ?? [] : [],
    };
  });

  if (oldPending.length > 0) {
    const { error } = await supabase.from("emi_installments").delete().in("id", oldPending.map((r) => r.id)).eq("status", "pending");
    if (error) {
      console.error("Failed to clear unpaid EMI installments", enrollmentId, error);
      return new Response("Couldn't save the plan.", { status: 500 });
    }
  }
  if (newRows.length > 0) {
    const { error } = await supabase.from("emi_installments").insert(newRows);
    if (error) {
      console.error("Failed to save new EMI installments — restoring the old ones", enrollmentId, error);
      if (oldPending.length > 0) await supabase.from("emi_installments").insert(oldPending.map(({ created_at: _created, ...r }) => r));
      return new Response("Couldn't save the plan.", { status: 500 });
    }
  }
  if (paid.length > 0) {
    await supabase.from("emi_installments").update({ installment_count: count }).in("id", paid.map((r) => r.id));
  }
  return Response.json({ ok: true });
}
