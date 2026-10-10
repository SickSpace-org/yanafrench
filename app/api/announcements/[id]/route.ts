import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// DELETE — the admin removes any announcement (her own or a teacher's), e.g.
// to take down something sent by mistake. Teachers can't delete theirs.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete announcement", id, error);
    return new Response("Couldn't delete the announcement.", { status: 500 });
  }
  return Response.json({ ok: true });
}
