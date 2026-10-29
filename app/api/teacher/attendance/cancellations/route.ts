import { authErrorResponse } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { cancelClass, cleanNote, restoreClass, validateCancelDate } from "@/lib/classCancellations";
import { requireTeacher, type TeacherContext } from "@/lib/teachers";

// The teacher's "Cancel a class" — same as Admin → Attendance
// (app/api/attendance/cancellations), limited to the teacher's own batches
// by requireTeacher({ batchId }).
// POST   { batchId, date, note? } → cancel that class and email its students
// DELETE { batchId, date }        → undo; emails "back on" if still ahead
async function handle(req: Request, action: "cancel" | "restore") {
  const body = (await req.json().catch(() => null)) as { batchId?: unknown; date?: unknown; note?: unknown } | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }

  const date = typeof body?.date === "string" ? body.date : "";
  const batch = (await readPortalState()).batches.find((b) => b.id === batchId)!;
  const problem = validateCancelDate(batch, date);
  if (problem) return new Response(problem, { status: 400 });

  const result =
    action === "cancel"
      ? await cancelClass(ctx.supabase, batch, { date, note: cleanNote(body?.note), by: `teacher:${ctx.teacher.id}` })
      : await restoreClass(ctx.supabase, batch, date);
  return result.ok ? Response.json(result) : new Response(result.message, { status: result.status });
}

export function POST(req: Request) {
  return handle(req, "cancel");
}

export function DELETE(req: Request) {
  return handle(req, "restore");
}
