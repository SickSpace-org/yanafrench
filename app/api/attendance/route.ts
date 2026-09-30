import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { setManualAttendance } from "@/lib/attendance";
import { addDays, isoToIndiaDate, todayInIndia } from "@/lib/emiData";
import { attendanceFromRow, hasSessionOn, resolveSessionStatus, sessionDates, type AttendanceRow } from "@/lib/attendanceData";

// Admin → Attendance.
// GET ?batchId=X             → the batch's class dates (last 60 days + next 7)
// GET ?batchId=X&date=D      → every student enrolled in X by D, with their
//                              attendance for that class (live — the page polls)
// POST { studentId, batchId, date, status } → manual present/absent
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const url = new URL(req.url);
  const batchId = url.searchParams.get("batchId");
  const date = url.searchParams.get("date");
  const state = await readPortalState();
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) return new Response("Unknown batch.", { status: 404 });

  const today = todayInIndia();
  if (!date) {
    return Response.json({ today, dates: sessionDates(batch, addDays(today, -60), addDays(today, 7)) });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !hasSessionOn(batch, date)) {
    return new Response("No class on that date.", { status: 400 });
  }

  const [{ data: enrollments }, { data: records }] = await Promise.all([
    supabase.from("batch_enrollments").select("student_id, enrolled_at, students(id, name, email, phone)").eq("batch_id", batch.id).eq("status", "active"),
    supabase.from("attendance").select("*").eq("batch_id", batch.id).eq("class_date", date),
  ]);
  const byStudent = new Map(((records as AttendanceRow[]) ?? []).map((r) => [r.student_id, attendanceFromRow(r)]));

  type EnrollmentJoin = { student_id: string; enrolled_at: string; students: { id: string; name: string; email: string; phone: string } | null };
  const students = ((enrollments as unknown as EnrollmentJoin[]) ?? [])
    // Only students who were already enrolled on that class date.
    .filter((e) => e.students && isoToIndiaDate(e.enrolled_at) <= date)
    .map((e) => {
      const rec = byStudent.get(e.student_id);
      return {
        studentId: e.student_id,
        name: e.students!.name,
        email: e.students!.email,
        status: resolveSessionStatus(batch, date, rec),
        source: rec?.source ?? null,
        markedAt: rec?.markedAt ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return Response.json({ today, date, students });
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

  const { error } = await setManualAttendance(supabase, { studentId, batchId, date, status });
  if (error) {
    console.error("Failed to save manual attendance", error);
    return new Response("Failed to save.", { status: 500 });
  }
  return Response.json({ ok: true });
}
