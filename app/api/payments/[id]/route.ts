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
