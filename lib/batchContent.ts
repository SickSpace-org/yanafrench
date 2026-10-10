// Server-only reads of per-batch class content (service-role client;
// RLS on with no policies). Callers decide WHICH batches a viewer may see —
// a teacher's own (requireTeacher), a student's active enrollments
// (lib/classLinks.ts viewerBatchIds), or every batch for the admin.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Viewer } from "./auth";
import type { BatchMaterial, BatchRecording } from "./batchContentData";
import { getTeacherByUserId, teacherBatchIds } from "./teachers";
import { readPortalState } from "./portalStateServer";

export const RECORDING_COLUMNS = "id, batch_id, title, url, class_date, author_name, created_at";
export const MATERIAL_COLUMNS = "id, batch_id, title, file_name, content_type, size_bytes, author_name, created_at";

type RecordingRow = { id: string; batch_id: string; title: string; url: string; class_date: string | null; author_name: string; created_at: string };
type MaterialRow = { id: string; batch_id: string; title: string; file_name: string; content_type: string; size_bytes: number; author_name: string; created_at: string };

export function recordingFromRow(r: RecordingRow): BatchRecording {
  return { id: r.id, batchId: r.batch_id, title: r.title, url: r.url, classDate: r.class_date, authorName: r.author_name, createdAt: r.created_at };
}

export function materialFromRow(r: MaterialRow): BatchMaterial {
  return {
    id: r.id,
    batchId: r.batch_id,
    title: r.title,
    fileName: r.file_name,
    contentType: r.content_type,
    sizeBytes: Number(r.size_bytes),
    authorName: r.author_name,
    createdAt: r.created_at,
  };
}

// batchIds null = every batch (admin).
export async function listBatchContent(
  supabase: SupabaseClient,
  batchIds: string[] | null
): Promise<{ recordings: BatchRecording[]; materials: BatchMaterial[] }> {
  if (batchIds && batchIds.length === 0) return { recordings: [], materials: [] };
  let rq = supabase.from("batch_recordings").select(RECORDING_COLUMNS).order("class_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  let mq = supabase.from("batch_materials").select(MATERIAL_COLUMNS).order("created_at", { ascending: false });
  if (batchIds) {
    rq = rq.in("batch_id", batchIds);
    mq = mq.in("batch_id", batchIds);
  }
  const [{ data: recs, error: recErr }, { data: mats, error: matErr }] = await Promise.all([rq, mq]);
  if (recErr) throw recErr;
  if (matErr) throw matErr;
  return {
    recordings: ((recs as RecordingRow[]) ?? []).map(recordingFromRow),
    materials: ((mats as MaterialRow[]) ?? []).map(materialFromRow),
  };
}

// May this viewer open content of this batch? The admin: always. A
// teacher: only an ACTIVE teacher whose batch it is. A student: only with
// an ACTIVE enrollment in it. Either way the batch must still exist.
export async function viewerCanSeeBatch(supabase: SupabaseClient, viewer: Viewer, batchId: string): Promise<boolean> {
  if (viewer.role === "admin") return true;
  if (viewer.role === "teacher") {
    const teacher = await getTeacherByUserId(supabase, viewer.userId);
    if (!teacher || teacher.status !== "active") return false;
    const { batches } = await readPortalState();
    return (await teacherBatchIds(supabase, teacher.id, batches)).includes(batchId);
  }
  if (viewer.role === "student") {
    const { batches } = await readPortalState();
    if (!batches.some((b) => b.id === batchId)) return false;
    const { data: student } = await supabase.from("students").select("id").eq("user_id", viewer.userId).maybeSingle();
    if (!student) return false;
    const { data } = await supabase
      .from("batch_enrollments")
      .select("id")
      .eq("student_id", student.id)
      .eq("batch_id", batchId)
      .eq("status", "active")
      .limit(1);
    return !!data && data.length > 0;
  }
  return false;
}
