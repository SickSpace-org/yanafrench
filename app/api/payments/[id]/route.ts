import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// DELETE: Admin → Payments' Remove action (cleanup, e.g. test entries).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  // Ids are unique across both tables (Razorpay order ids / manual-…), so
  // deleting from both removes the one row wherever it lives.
  const [{ error: batchErr }, { error: courseErr }] = await Promise.all([
    supabase.from("payments").delete().eq("id", id),
    supabase.from("course_payments").delete().eq("id", id),
  ]);
  const error = batchErr || courseErr;
  if (error) {
    console.error("Failed to delete payment", id, error);
    return new Response("Failed to delete payment.", { status: 500 });
  }
  return Response.json({ ok: true });
}

// PATCH { rupees }: Admin → Payments' editable "amount paid" on a student's
// first payment (batch or course). Amounts are stored in paise.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { rupees?: unknown } | null;
  const rupees = Number(body?.rupees);
  if (!Number.isFinite(rupees) || rupees < 0 || rupees > 10_000_000) return new Response("Enter a valid amount.", { status: 400 });
  const amount = Math.round(rupees * 100);

  const [{ data: b, error: bErr }, { data: c, error: cErr }] = await Promise.all([
    supabase.from("payments").update({ amount }).eq("id", id).select("id"),
    supabase.from("course_payments").update({ amount }).eq("id", id).select("id"),
  ]);
  if (bErr || cErr) {
    console.error("Failed to update payment", id, bErr || cErr);
    return new Response("Couldn't update the amount.", { status: 500 });
  }
  if (!b?.length && !c?.length) return new Response("Payment not found.", { status: 404 });
  return Response.json({ ok: true });
}
