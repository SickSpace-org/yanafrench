import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { cancelClass, cleanNote, restoreClass, validateCancelDate } from "@/lib/classCancellations";

// Admin → Attendance, "Cancel a class" (lib/classCancellations.ts; the
// teacher portal's equivalent is app/api/teacher/attendance/cancellations).
// POST   { batchId, date, note? } → cancel that class and email its students
// DELETE { batchId, date }        → undo; emails "back on" if still ahead
// Both answer { ok, emailed } — how many students are being emailed.
async function handle(req: Request, action: "cancel" | "restore") {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = (await req.json().catch(() => null)) as { batchId?: unknown; date?: unknown; note?: unknown } | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const batch = (await readPortalState()).batches.find((b) => b.id === batchId);
  if (!batch) return new Response("Unknown batch.", { status: 404 });
  const problem = validateCancelDate(batch, date);
  if (problem) return new Response(problem, { status: 400 });

  const result =
    action === "cancel" ? await cancelClass(supabase, batch, { date, note: cleanNote(body?.note), by: "admin" }) : await restoreClass(supabase, batch, date);
  return result.ok ? Response.json(result) : new Response(result.message, { status: result.status });
}

export function POST(req: Request) {
  return handle(req, "cancel");
}

export function DELETE(req: Request) {
  return handle(req, "restore");
}
