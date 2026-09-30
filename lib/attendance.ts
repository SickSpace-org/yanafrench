// Server-side attendance operations (rules in lib/attendanceData.ts).
// Service-role client only — attendance has RLS on with no policies.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Batch } from "./batchData";
import { isoToIndiaDate, todayInIndia, addDays } from "./emiData";
import {
  attendanceFromRow,
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

// Admin's manual present/absent — overwrites whatever is there.
export async function setManualAttendance(
  supabase: SupabaseClient,
  input: { studentId: string; batchId: string; date: string; status: AttendanceStatus }
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
