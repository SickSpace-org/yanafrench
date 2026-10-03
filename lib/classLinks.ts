// Per-batch class meeting links (server only, service-role client). Set in
// Admin -> Attendance; students get the link for their own batches on the
// dashboard, and "Join class" (app/api/attendance/join) forwards to it.
// Batches without one fall back to the global Zoom link in portal state.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Viewer } from "./auth";

export function cleanClassLink(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const url = input.trim();
  if (!url) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

// batchIds null = every batch.
export async function getClassLinks(supabase: SupabaseClient, batchIds: string[] | null): Promise<Record<string, string>> {
  if (batchIds && batchIds.length === 0) return {};
  let query = supabase.from("class_links").select("batch_id, url");
  if (batchIds) query = query.in("batch_id", batchIds);
  const { data, error } = await query;
  if (error) {
    console.error("Failed to load class links", error);
    return {};
  }
  return Object.fromEntries((data ?? []).map((r) => [r.batch_id as string, r.url as string]));
}

export async function setClassLink(supabase: SupabaseClient, batchId: string, url: string | null) {
  if (!url) return supabase.from("class_links").delete().eq("batch_id", batchId);
  return supabase.from("class_links").upsert({ batch_id: batchId, url, updated_at: new Date().toISOString() }, { onConflict: "batch_id" });
}

// The batches whose links this viewer may see: a student's active
// enrollments; null (= all) for an admin previewing the hub.
export async function viewerBatchIds(supabase: SupabaseClient, viewer: Viewer): Promise<{ studentId: string | null; batchIds: string[] | null }> {
  if (viewer.role === "admin") return { studentId: null, batchIds: null };
  const { data: student } = await supabase.from("students").select("id").eq("user_id", viewer.userId).maybeSingle();
  if (!student) return { studentId: null, batchIds: [] };
  const { data: enrollments } = await supabase.from("batch_enrollments").select("batch_id").eq("student_id", student.id).eq("status", "active");
  return { studentId: student.id as string, batchIds: [...new Set((enrollments ?? []).map((e) => e.batch_id as string))] };
}
