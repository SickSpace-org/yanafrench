import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { MANUAL_PAYMENT_PREFIX } from "@/lib/enrollmentRequestData";

// Admin → EMI's manual controls for one installment.
// POST { action: "paid" }   → mark it paid (records a manual emi_payments
//                             row). Unlocks the student's hub immediately if
//                             this was the overdue one (see isStudentHubLocked).
// POST { action: "unpaid" } → undo a manual mark. Refused for installments
//                             the student paid online, which can't be undone here.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const { data: inst } = await supabase.from("emi_installments").select("*").eq("id", id).maybeSingle();
  if (!inst) return new Response("Installment not found.", { status: 404 });

  if (body?.action === "paid") {
    if (inst.status === "paid") return new Response("This installment is already paid.", { status: 409 });
    const paidAt = new Date().toISOString();
    const { error: payErr } = await supabase.from("emi_payments").insert({
      id: `${MANUAL_PAYMENT_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      installment_id: inst.id,
      student_id: inst.student_id,
      amount: inst.amount,
      status: "paid",
      razorpay_payment_id: null,
      created_at: paidAt,
      paid_at: paidAt,
    });
    if (payErr) {
      console.error("Failed to record manual EMI payment", id, payErr);
      return new Response("Couldn't mark it paid.", { status: 500 });
    }
    const { error } = await supabase.from("emi_installments").update({ status: "paid", paid_at: paidAt }).eq("id", id).eq("status", "pending");
    if (error) {
      console.error("Failed to mark EMI installment paid", id, error);
      return new Response("Couldn't mark it paid.", { status: 500 });
    }
    return Response.json({ ok: true });
  }

  if (body?.action === "unpaid") {
    if (inst.status !== "paid") return new Response("This installment isn't marked paid.", { status: 409 });
    const { data: payments } = await supabase.from("emi_payments").select("id, status").eq("installment_id", id).eq("status", "paid");
    const online = (payments ?? []).filter((p) => !String(p.id).startsWith(MANUAL_PAYMENT_PREFIX));
    if (online.length > 0) return new Response("The student paid this online, so it can't be undone here.", { status: 409 });
    await supabase.from("emi_payments").delete().eq("installment_id", id).like("id", `${MANUAL_PAYMENT_PREFIX}%`);
    const { error } = await supabase.from("emi_installments").update({ status: "pending", paid_at: null }).eq("id", id);
    if (error) {
      console.error("Failed to undo EMI installment payment", id, error);
      return new Response("Couldn't undo it.", { status: 500 });
    }
    return Response.json({ ok: true });
  }

  return new Response("Unknown action.", { status: 400 });
}
