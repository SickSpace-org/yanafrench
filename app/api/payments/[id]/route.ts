import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// DELETE: Admin → Payments' Remove action (cleanup, e.g. test entries).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete payment", id, error);
    return new Response("Failed to delete payment.", { status: 500 });
  }
  return Response.json({ ok: true });
}
