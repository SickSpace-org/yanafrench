// Server-side attendance operations (rules in lib/attendanceData.ts).
// Service-role client only — attendance has RLS on with no policies.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Batch } from "./batchData";
import { isoToIndiaDate, todayInIndia, addDays } from "./emiData";
import {
  attendanceFromRow,
  hasSessionOn,
  openSessionDate,
  resolveSessionStatus,
  sessionDates,
  type AttendanceRecord,
  type AttendanceRow,
  type AttendanceSource,
  type AttendanceStatus,
  type SessionStatus,
} from "./attendanceData";

function attendanceId(studentId: string, batchId: string, date: string) {
  return `att-${studentId}-${batchId}-${date}`;
}

// Called when a student clicks "Join class": marks them present in every
// one of their batches whose join window is open right now. Never
// overwrites an existing row — a manual mark by the admin always wins,
// and a second click is a no-op. Returns the batch ids marked.
export async function markJoinAttendance(
  supabase: SupabaseClient,
  studentId: string,
  enrolledBatchIds: string[],
  batches: Batch[],
  now: number = Date.now()
): Promise<string[]> {
  const rows = batches
    .filter((b) => enrolledBatchIds.includes(b.id))
    .map((b) => ({ batch: b, date: openSessionDate(b, now) }))
    .filter((x): x is { batch: Batch; date: string } => !!x.date)
    .map(({ batch, date }) => ({
      id: attendanceId(studentId, batch.id, date),
      student_id: studentId,
      batch_id: batch.id,
      class_date: date,
      status: "present",
      source: "auto",
      marked_at: new Date(now).toISOString(),
    }));
  if (rows.length === 0) return [];
  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "student_id,batch_id,class_date", ignoreDuplicates: true });
  if (error) console.error("Failed to record join attendance for", studentId, error);
  return rows.map((r) => r.batch_id);
}

// Manual present/absent by the admin or the batch's teacher — overwrites
// whatever is there. markedBy is 'admin' or 'teacher:<teachers.id>' (see
// supabase/migrations/20261009130000_attendance_marked_by.sql).
export type MarkedBy = "admin" | `teacher:${string}`;

export async function setManualAttendance(
  supabase: SupabaseClient,
  input: { studentId: string; batchId: string; date: string; status: AttendanceStatus; markedBy: MarkedBy }
) {
  return supabase.from("attendance").upsert(
    {
      id: attendanceId(input.studentId, input.batchId, input.date),
      student_id: input.studentId,
      batch_id: input.batchId,
      class_date: input.date,
      status: input.status,
      source: "manual" satisfies AttendanceSource,
      marked_at: new Date().toISOString(),
      marked_by: input.markedBy,
    },
    { onConflict: "student_id,batch_id,class_date" }
  );
}

export type StudentSession = {
  batchId: string;
  batchName: string;
  course: string;
  date: string;
  status: SessionStatus;
  source: AttendanceSource | null;
};

// A student's own class history for their Attendance page: every session
// of each enrolled batch from the day they enrolled (or the batch
// started) up to today, capped to the last `days` days.
export async function studentSessions(
  supabase: SupabaseClient,
  studentId: string,
  enrollments: { batchId: string; enrolledAt: string }[],
  batches: Batch[],
  days = 120
): Promise<StudentSession[]> {
  const today = todayInIndia();
  const floor = addDays(today, -days);
  const { data } = await supabase.from("attendance").select("*").eq("student_id", studentId).gte("class_date", floor);
  const records = new Map<string, AttendanceRecord>();
  for (const row of (data as AttendanceRow[]) ?? []) {
    const r = attendanceFromRow(row);
    records.set(`${r.batchId}|${r.classDate}`, r);
  }

  const sessions: StudentSession[] = [];
  for (const e of enrollments) {
    const batch = batches.find((b) => b.id === e.batchId);
    if (!batch) continue;
    const enrolled = isoToIndiaDate(e.enrolledAt);
    const from = enrolled > floor ? enrolled : floor;
    for (const date of sessionDates(batch, from, today)) {
      const rec = records.get(`${batch.id}|${date}`);
      sessions.push({
        batchId: batch.id,
        batchName: batch.name,
        course: batch.course,
        date,
        status: resolveSessionStatus(batch, date, rec),
        source: rec?.source ?? null,
      });
    }
  }
  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}

// ---- Attendance register (Admin -> Attendance and the teacher portal) ----

export const REGISTER_DAYS = 30;

export type RegisterCell = {
  status: SessionStatus;
  source: AttendanceSource | null;
  markedAt: string | null;
  // Who marked a manual cell: "Yana", a teacher's name, or "a former teacher".
  markedBy: string | null;
} | null;

export type Register = {
  today: string;
  dates: string[];
  students: { studentId: string; name: string; email?: string; cells: Record<string, RegisterCell> }[];
};

// One batch's register: class dates of the last REGISTER_DAYS days (newest
// first) and, for every ACTIVE enrollment, a cell per date (null before the
// student enrolled). withEmail is for the admin only — the teacher register
// carries names, never contact details. Explicit columns only.
export async function buildRegister(supabase: SupabaseClient, batch: Batch, opts: { withEmail: boolean }): Promise<Register> {
  const today = todayInIndia();
  const dates = sessionDates(batch, addDays(today, -REGISTER_DAYS), today);
  const studentCols = opts.withEmail ? "id, name, email" : "id, name";

  const [{ data: enrollments, error: enrErr }, { data: records, error: recErr }] = await Promise.all([
    supabase.from("batch_enrollments").select(`student_id, enrolled_at, students(${studentCols})`).eq("batch_id", batch.id).eq("status", "active"),
    dates.length
      ? supabase
          .from("attendance")
          .select("id, student_id, batch_id, class_date, status, source, marked_at, marked_by")
          .eq("batch_id", batch.id)
          .gte("class_date", dates[dates.length - 1])
          .lte("class_date", today)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (enrErr) throw enrErr;
  if (recErr) throw recErr;

  type Row = AttendanceRow & { marked_by: string | null };
  const rows = (records as Row[]) ?? [];
  const byKey = new Map(rows.map((r) => [`${r.student_id}|${r.class_date}`, { rec: attendanceFromRow(r), markedBy: r.marked_by }]));

  const teacherIds = [...new Set(rows.map((r) => r.marked_by).filter((m): m is string => !!m?.startsWith("teacher:")).map((m) => m.slice(8)))];
  const teacherNames = new Map<string, string>();
  if (teacherIds.length) {
    const { data } = await supabase.from("teachers").select("id, full_name").in("id", teacherIds);
    for (const t of data ?? []) teacherNames.set(t.id as string, t.full_name as string);
  }
  const label = (m: string | null) =>
    !m ? null : m === "admin" ? "Yana" : m.startsWith("teacher:") ? teacherNames.get(m.slice(8)) ?? "a former teacher" : null;

  type EnrollmentJoin = { student_id: string; enrolled_at: string; students: { id: string; name: string; email?: string } | null };
  const now = Date.now();
  const students = ((enrollments as unknown as EnrollmentJoin[]) ?? [])
    .filter((e) => e.students)
    .map((e) => {
      const enrolled = isoToIndiaDate(e.enrolled_at);
      const cells: Record<string, RegisterCell> = {};
      for (const date of dates) {
        if (date < enrolled) {
          cells[date] = null;
          continue;
        }
        const hit = byKey.get(`${e.student_id}|${date}`);
        cells[date] = {
          status: resolveSessionStatus(batch, date, hit?.rec, now),
          source: hit?.rec.source ?? null,
          markedAt: hit?.rec.markedAt ?? null,
          markedBy: hit?.rec.source === "manual" ? label(hit.markedBy) : null,
        };
      }
      return {
        studentId: e.student_id,
        name: e.students!.name,
        ...(opts.withEmail ? { email: e.students!.email ?? "" } : {}),
        cells,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { today, dates, students };
}

// Validates a manual mark: the date is a real class of that batch, up to
// today, and the student held an ACTIVE enrollment in it by then (the
// register shows earlier classes as "not enrolled yet", so a mark there
// would be invisible). Returns an error message or null.
export async function validateManualMark(
  supabase: SupabaseClient,
  batch: Batch,
  input: { studentId: string; date: string }
): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !hasSessionOn(batch, input.date)) return "No class on that date.";
  if (input.date > todayInIndia()) return "That class hasn't happened yet.";
  const { data, error } = await supabase
    .from("batch_enrollments")
    .select("enrolled_at")
    .eq("batch_id", batch.id)
    .eq("student_id", input.studentId)
    .eq("status", "active");
  if (error) throw error;
  if (!data || data.length === 0) return "That student isn't in this batch.";
  const enrolled = data.map((e) => isoToIndiaDate(e.enrolled_at as string)).sort()[0];
  return input.date < enrolled ? "That student hadn't joined this batch yet on that date." : null;
}
