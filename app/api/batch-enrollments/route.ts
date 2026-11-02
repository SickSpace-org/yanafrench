import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { addStudentToBatchAsAdmin } from "@/lib/enrollment";

// POST: Admin → Students' "Add to batch" action — the admin places an
// existing student into any batch by hand, no payment involved (see
// addStudentToBatchAsAdmin in lib/enrollment.ts).
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = await req.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  if (!studentId || !batchId) return new Response("studentId and batchId are required.", { status: 400 });

  const batch = (await readPortalState()).batches.find((b) => b.id === batchId);
  if (!batch) return new Response("That batch doesn't exist.", { status: 404 });

  const { data: student } = await supabase.from("students").select("id").eq("id", studentId).maybeSingle();
  if (!student) return new Response("That student doesn't exist.", { status: 404 });

  const error = await addStudentToBatchAsAdmin(supabase, studentId, batch);
  if (error?.code === "23505") return new Response("This student is already in that batch.", { status: 409 });
  if (error) {
    console.error("Failed to add student", studentId, "to batch", batchId, error);
    return new Response("Failed to add to batch.", { status: 500 });
  }
  return Response.json({ ok: true });
}
