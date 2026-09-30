import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { setManualAttendance } from "@/lib/attendance";
import { addDays, isoToIndiaDate, todayInIndia } from "@/lib/emiData";
import { attendanceFromRow, hasSessionOn, resolveSessionStatus, sessionDates, type AttendanceRow, type AttendanceSource, type SessionStatus } from "@/lib/attendanceData";

// Admin → Attendance register.
// GET ?batchId=X → the batch's class dates (last 30 days up to today, newest
//                  first) and, for every student enrolled in X, a P/A cell per
//                  date (live — the page polls). A cell is null for classes
//                  held before that student enrolled.
// POST { studentId, batchId, date, status } → manual present/absent
const REGISTER_DAYS = 30;

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

  const today = todayInIndia();
  const dates = sessionDates(batch, addDays(today, -REGISTER_DAYS), today);

  const [{ data: enrollments }, { data: records }] = await Promise.all([
    supabase.from("batch_enrollments").select("student_id, enrolled_at, students(id, name, email)").eq("batch_id", batch.id).eq("status", "active"),
    dates.length
      ? supabase.from("attendance").select("*").eq("batch_id", batch.id).gte("class_date", dates[dates.length - 1]).lte("class_date", today)
      : Promise.resolve({ data: [] }),
  ]);
  const byKey = new Map(((records as AttendanceRow[]) ?? []).map((r) => [`${r.student_id}|${r.class_date}`, attendanceFromRow(r)]));

  type EnrollmentJoin = { student_id: string; enrolled_at: string; students: { id: string; name: string; email: string } | null };
  const now = Date.now();
  const students = ((enrollments as unknown as EnrollmentJoin[]) ?? [])
    .filter((e) => e.students)
    .map((e) => {
      const enrolled = isoToIndiaDate(e.enrolled_at);
      const cells: Record<string, { status: SessionStatus; source: AttendanceSource | null; markedAt: string | null } | null> = {};
      for (const date of dates) {
        if (date < enrolled) {
          cells[date] = null;
          continue;
        }
        const rec = byKey.get(`${e.student_id}|${date}`);
        cells[date] = { status: resolveSessionStatus(batch, date, rec, now), source: rec?.source ?? null, markedAt: rec?.markedAt ?? null };
      }
      return { studentId: e.student_id, name: e.students!.name, email: e.students!.email, cells };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return Response.json({ today, dates, students });
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
