import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { deleteEnrollmentRequest } from "@/lib/enrollmentRequests";

// DELETE: Admin → Enrollments' Remove action (spam, duplicates, tests).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { error } = await deleteEnrollmentRequest(supabase, id);
  if (error) {
    console.error("Failed to delete enrollment request", id, error);
    return new Response("Failed to delete.", { status: 500 });
  }
  return Response.json({ ok: true });
}
