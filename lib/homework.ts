// Server-side homework helpers (see lib/homeworkData.ts for the shapes).
// Service-role client only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Viewer } from "./auth";

// Which homework this viewer may see: a student sees homework for the
// batches they're actively enrolled in. An admin is treated as enrolled in
// every batch (batchIds null = all): one with a linked student record can
// answer and submit like a student; one without (studentId null) sees all
// of it read-only. Returns null when there's nothing to show (no student
// record, or no active batch).
export async function studentHomeworkAccess(
  supabase: SupabaseClient,
  viewer: Viewer
): Promise<{ studentId: string | null; batchIds: string[] | null } | null> {
  const { data: student } = await supabase.from("students").select("id").eq("user_id", viewer.userId).maybeSingle();
  if (viewer.role === "admin") return { studentId: (student?.id as string) ?? null, batchIds: null };
  if (!student) return null;
  const { data: enrollments } = await supabase.from("batch_enrollments").select("batch_id").eq("student_id", student.id).eq("status", "active");
  const batchIds = [...new Set((enrollments ?? []).map((e) => e.batch_id as string))];
  if (batchIds.length === 0) return null;
  return { studentId: student.id as string, batchIds };
}

// Distinct students with an active enrollment in any of these batches —
// the people a homework was sent to.
export async function homeworkRecipients(
  supabase: SupabaseClient,
  batchIds: string[]
): Promise<{ studentId: string; name: string; email: string; batchIds: string[] }[]> {
  if (batchIds.length === 0) return [];
  const { data } = await supabase
    .from("batch_enrollments")
    .select("student_id, batch_id, students(id, name, email)")
    .in("batch_id", batchIds)
    .eq("status", "active");
  type Join = { student_id: string; batch_id: string; students: { id: string; name: string; email: string } | null };
  const byStudent = new Map<string, { studentId: string; name: string; email: string; batchIds: string[] }>();
  for (const row of (data as unknown as Join[]) ?? []) {
    if (!row.students) continue;
    const entry = byStudent.get(row.student_id) ?? { studentId: row.student_id, name: row.students.name, email: row.students.email, batchIds: [] };
    if (!entry.batchIds.includes(row.batch_id)) entry.batchIds.push(row.batch_id);
    byStudent.set(row.student_id, entry);
  }
  return [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name));
}
