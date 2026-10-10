// Server-only announcement operations (service-role client; RLS on with no
// policies). Who may send to which batch is decided by the calling route:
// requireTeacher({ batchId }) for a teacher, requireAdmin() for the admin.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ANNOUNCEMENT_COLUMNS,
  announcementFromRow,
  type Announcement,
  type AnnouncementRow,
} from "./announcementData";

export class AnnouncementError extends Error {}

// Inserts one announcement. A single-student announcement is only allowed
// for a student with an ACTIVE enrollment in that batch.
export async function sendAnnouncement(
  supabase: SupabaseClient,
  input: {
    batchId: string;
    studentId: string | null;
    sender: { type: "teacher"; teacherId: string; name: string } | { type: "admin"; name: string };
    body: string;
  }
): Promise<Announcement> {
  if (input.studentId) {
    const { data, error } = await supabase
      .from("batch_enrollments")
      .select("id")
      .eq("batch_id", input.batchId)
      .eq("student_id", input.studentId)
      .eq("status", "active")
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) throw new AnnouncementError("That student isn't in this batch.");
  }

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      batch_id: input.batchId,
      student_id: input.studentId,
      sender_type: input.sender.type,
      teacher_id: input.sender.type === "teacher" ? input.sender.teacherId : null,
      sender_name: input.sender.name,
      body: input.body,
    })
    .select(ANNOUNCEMENT_COLUMNS)
    .single();
  if (error || !data) throw error ?? new Error("Insert returned no row");
  return announcementFromRow(data as AnnouncementRow);
}

// Announcements of one batch, newest first, with recipient names for the
// sender's view. teacherId limits it to that teacher's own announcements —
// a teacher never sees the admin's notes to individual students.
export async function listBatchAnnouncements(
  supabase: SupabaseClient,
  batchId: string,
  opts: { teacherId?: string } = {}
): Promise<Announcement[]> {
  let q = supabase.from("announcements").select(ANNOUNCEMENT_COLUMNS).eq("batch_id", batchId).order("created_at", { ascending: false }).limit(200);
  if (opts.teacherId) q = q.eq("sender_type", "teacher").eq("teacher_id", opts.teacherId);
  const { data, error } = await q;
  if (error) throw error;
  const list = ((data as AnnouncementRow[]) ?? []).map(announcementFromRow);

  const ids = [...new Set(list.map((a) => a.studentId).filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: students } = await supabase.from("students").select("id, name").in("id", ids);
    for (const s of students ?? []) names.set(s.id as string, s.name as string);
  }
  return list.map((a) => ({ ...a, studentName: a.studentId ? names.get(a.studentId) ?? "a former student" : null }));
}

// What one student sees: whole-batch announcements of each batch they're
// ACTIVELY in, from the day they joined it, plus every announcement
// addressed to them alone. Newest first.
export async function listStudentAnnouncements(supabase: SupabaseClient, studentId: string): Promise<Announcement[]> {
  const { data: enrollments, error: enrErr } = await supabase
    .from("batch_enrollments")
    .select("batch_id, enrolled_at")
    .eq("student_id", studentId)
    .eq("status", "active");
  if (enrErr) throw enrErr;
  const joined = new Map<string, number>();
  for (const e of enrollments ?? []) {
    const at = Date.parse(e.enrolled_at as string);
    const prev = joined.get(e.batch_id as string);
    if (prev === undefined || at < prev) joined.set(e.batch_id as string, at);
  }

  const [batchWide, personal] = await Promise.all([
    joined.size
      ? supabase.from("announcements").select(ANNOUNCEMENT_COLUMNS).is("student_id", null).in("batch_id", [...joined.keys()]).order("created_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("announcements").select(ANNOUNCEMENT_COLUMNS).eq("student_id", studentId).order("created_at", { ascending: false }).limit(200),
  ]);
  if (batchWide.error) throw batchWide.error;
  if (personal.error) throw personal.error;

  const wide = ((batchWide.data as AnnouncementRow[]) ?? []).filter((r) => Date.parse(r.created_at) >= (joined.get(r.batch_id) ?? Infinity));
  return [...wide, ...((personal.data as AnnouncementRow[]) ?? [])]
    .map(announcementFromRow)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
