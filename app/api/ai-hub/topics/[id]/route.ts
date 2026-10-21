import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// DELETE: admin removes a speaking topic.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { error } = await supabase.from("ai_hub_topics").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete speaking topic", id, error);
    return new Response("Couldn't remove the topic.", { status: 500 });
  }
  return Response.json({ ok: true });
}
