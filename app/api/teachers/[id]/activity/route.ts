import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import type { AuditEntry } from "@/lib/teacherAudit";

// GET → the last 200 things this teacher created, changed or deleted
// (teacher_content_audit), newest first. Admin only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const { id } = await params;
  const { data, error } = await supabase
    .from("teacher_content_audit")
    .select("id, teacher_id, teacher_name, batch_id, content_type, content_id, action, title, detail, created_at")
    .eq("teacher_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Failed to load teacher activity", id, error);
    return new Response("Failed to load activity.", { status: 500 });
  }
  const entries: AuditEntry[] = (data ?? []).map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    batchId: r.batch_id,
    contentType: r.content_type,
    contentId: r.content_id,
    action: r.action,
    title: r.title,
    detail: r.detail,
    createdAt: r.created_at,
  }));
  return Response.json(entries);
}
