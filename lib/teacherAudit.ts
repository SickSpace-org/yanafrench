// Server-only. Append-only log of what teachers create, change and delete
// (class links, recordings, materials, announcements), shown to the admin on
// Admin -> Teachers. See supabase/migrations/20261009140000_teacher_content.sql.
//
// Best-effort by design: the real change has already happened when this
// runs, so a failed audit write is logged and never undoes or fails it.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Teacher } from "./teacherData";

export type AuditContentType = "class_link" | "recording" | "material" | "announcement";
export type AuditAction = "created" | "updated" | "deleted";

export async function recordTeacherActivity(
  supabase: SupabaseClient,
  teacher: Pick<Teacher, "id" | "fullName">,
  entry: { batchId: string; contentType: AuditContentType; contentId: string; action: AuditAction; title?: string | null; detail?: string | null }
) {
  try {
    const { error } = await supabase.from("teacher_content_audit").insert({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      teacher_id: teacher.id,
      teacher_name: teacher.fullName,
      batch_id: entry.batchId,
      content_type: entry.contentType,
      content_id: entry.contentId,
      action: entry.action,
      title: entry.title ?? null,
      detail: entry.detail ?? null,
    });
    if (error) console.warn("teacher_content_audit insert failed", entry.contentType, entry.action, error.message);
  } catch (err) {
    console.warn("teacher_content_audit insert failed", entry.contentType, entry.action, err);
  }
}

export type AuditEntry = {
  id: string;
  teacherId: string | null;
  teacherName: string;
  batchId: string;
  contentType: AuditContentType;
  contentId: string;
  action: AuditAction;
  title: string | null;
  detail: string | null;
  createdAt: string;
};
