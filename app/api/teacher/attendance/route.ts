import { authErrorResponse } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { buildRegister, setManualAttendance, validateManualMark } from "@/lib/attendance";
import { requireTeacher, type TeacherContext } from "@/lib/teachers";

// The teacher's attendance register — same register and write path as
// Admin -> Attendance (lib/attendance.ts), limited to the teacher's own
// batches by requireTeacher({ batchId }), and without student emails.
// GET  ?batchId=X                         → register
// POST { studentId, batchId, date, status } → manual present/absent, only
//      for a past/today class of that batch and a student actively in it.

export async function GET(req: Request) {
  const batchId = new URL(req.url).searchParams.get("batchId") ?? "";
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }

  const batch = (await readPortalState()).batches.find((b) => b.id === batchId)!;
  try {
    return Response.json(await buildRegister(ctx.supabase, batch, { withEmail: false }));
  } catch (err) {
    console.error("Failed to load teacher attendance register", batchId, err);
    return new Response("Failed to load attendance.", { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { studentId?: unknown; batchId?: unknown; date?: unknown; status?: unknown } | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }

  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const status = body?.status;
  if (!studentId || !date || (status !== "present" && status !== "absent")) {
    return new Response("Missing or invalid fields.", { status: 400 });
  }

  const batch = (await readPortalState()).batches.find((b) => b.id === batchId)!;
  const problem = await validateManualMark(ctx.supabase, batch, { studentId, date });
  if (problem) return new Response(problem, { status: 400 });

  const { error } = await setManualAttendance(ctx.supabase, { studentId, batchId, date, status, markedBy: `teacher:${ctx.teacher.id}` });
  if (error) {
    console.error("Failed to save teacher attendance", error);
    return new Response("Failed to save.", { status: 500 });
  }
  return Response.json({ ok: true });
}
