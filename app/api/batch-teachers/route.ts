import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { getTeacherById } from "@/lib/teachers";

// PUT: assign a batch to a teacher, or (teacherId null) hand it back to
// Yana. One teacher per batch — batch_teachers is keyed by batch_id, so
// assigning replaces whoever had it.
export async function PUT(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = await req.json().catch(() => null);
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  const teacherId = typeof body?.teacherId === "string" && body.teacherId ? body.teacherId : null;
  if (!batchId) return new Response("batchId is required.", { status: 400 });

  if (!teacherId) {
    const { error } = await supabase.from("batch_teachers").delete().eq("batch_id", batchId);
    if (error) {
      console.error("Failed to unassign batch", batchId, error);
      return new Response("Failed to update the batch's teacher.", { status: 500 });
    }
    return Response.json({ ok: true });
  }

  const batch = (await readPortalState()).batches.find((b) => b.id === batchId);
  if (!batch) return new Response("That batch doesn't exist.", { status: 404 });
  const teacher = await getTeacherById(supabase, teacherId).catch(() => null);
  if (!teacher) return new Response("That teacher doesn't exist.", { status: 404 });

  const { error } = await supabase
    .from("batch_teachers")
    .upsert({ batch_id: batchId, teacher_id: teacherId, assigned_at: new Date().toISOString() }, { onConflict: "batch_id" });
  if (error) {
    console.error("Failed to assign batch", batchId, "to teacher", teacherId, error);
    return new Response("Failed to update the batch's teacher.", { status: 500 });
  }
  return Response.json({ ok: true });
}
