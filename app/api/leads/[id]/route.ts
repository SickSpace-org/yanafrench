import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import type { Lead } from "@/lib/leadData";

// PATCH: admin edits from Admin → Enrollments.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const patch = (await req.json().catch(() => null)) as Partial<Lead> | null;
  if (!patch) return new Response("Invalid patch.", { status: 400 });

  const update: Record<string, unknown> = {};
  if ("name" in patch) update.name = patch.name;
  if ("phone" in patch) update.phone = patch.phone;
  if ("email" in patch) update.email = patch.email;
  if ("currentLevel" in patch) update.current_level = patch.currentLevel;
  if ("notes" in patch) update.notes = patch.notes;
  if ("paymentStatus" in patch) update.payment_status = patch.paymentStatus;
  if ("razorpayOrderId" in patch) update.razorpay_order_id = patch.razorpayOrderId;
  if ("razorpayPaymentId" in patch) update.razorpay_payment_id = patch.razorpayPaymentId;

  if (Object.keys(update).length === 0) return Response.json({ ok: true });

  const { error } = await supabase.from("leads").update(update).eq("id", id);
  if (error) {
    console.error("Failed to update lead", id, error);
    return new Response("Failed to update lead.", { status: 500 });
  }
  return Response.json({ ok: true });
}

// DELETE: Admin → Enrollments' Remove action.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete lead", id, error);
    return new Response("Failed to delete lead.", { status: 500 });
  }
  return Response.json({ ok: true });
}
