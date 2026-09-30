import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// DELETE: Admin → Homework's Delete action — students stop seeing it.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { error } = await supabase.from("homework").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete homework", id, error);
    return new Response("Failed to delete homework.", { status: 500 });
  }
  return Response.json({ ok: true });
}
