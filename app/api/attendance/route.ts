import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { buildRegister, setManualAttendance } from "@/lib/attendance";
import { hasSessionOn } from "@/lib/attendanceData";

// Admin → Attendance register.
// GET ?batchId=X → the batch's class dates (last 30 days up to today, newest
//                  first) and, for every student enrolled in X, a P/A cell per
//                  date (live — the page polls). A cell is null for classes
//                  held before that student enrolled. See lib/attendance.ts.
// POST { studentId, batchId, date, status } → manual present/absent
// (the teacher portal's equivalent is app/api/teacher/attendance).
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const batchId = new URL(req.url).searchParams.get("batchId");
  const state = await readPortalState();
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) return new Response("Unknown batch.", { status: 404 });

  try {
    return Response.json(await buildRegister(supabase, batch, { withEmail: true }));
  } catch (err) {
    console.error("Failed to load attendance register", batch.id, err);
    return new Response("Failed to load attendance.", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = (await req.json().catch(() => null)) as { studentId?: string; batchId?: string; date?: string; status?: string } | null;
  const { studentId, batchId, date, status } = body ?? {};
  if (!studentId || !batchId || !date || (status !== "present" && status !== "absent")) {
    return new Response("Missing or invalid fields.", { status: 400 });
  }
  const state = await readPortalState();
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !hasSessionOn(batch, date)) {
    return new Response("No class on that date.", { status: 400 });
  }

  const { error } = await setManualAttendance(supabase, { studentId, batchId, date, status, markedBy: "admin" });
  if (error) {
    console.error("Failed to save manual attendance", error);
    return new Response("Failed to save.", { status: 500 });
  }
  return Response.json({ ok: true });
}
