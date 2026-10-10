import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { getTeacherById } from "@/lib/teachers";

// PATCH: Deactivate / Reactivate. Deactivating cuts off portal access on
// the teacher's very next request (lib/teachers.ts re-reads status every
// time) and keeps everything else — the login, assignments and history.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (status !== "active" && status !== "deactivated") {
    return new Response("status must be 'active' or 'deactivated'.", { status: 400 });
  }

  const { data, error } = await supabase
    .from("teachers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Failed to update teacher status", id, error);
    return new Response("Failed to update teacher.", { status: 500 });
  }
  if (!data) return new Response("Teacher not found.", { status: 404 });
  return Response.json({ ok: true });
}

// DELETE: Remove — deletes the teacher row (their batch assignments go with
// it, so those batches return to Yana) and then their login. The login is
// only deleted when it really is a plain teacher login: never an admin's,
// and never one a students row points at.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const teacher = await getTeacherById(supabase, id).catch(() => null);
  if (!teacher) return new Response("Teacher not found.", { status: 404 });

  const { error } = await supabase.from("teachers").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete teacher", id, error);
    return new Response("Failed to remove teacher.", { status: 500 });
  }

  if (teacher.userId) {
    const [{ data: role }, { data: student }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", teacher.userId).maybeSingle(),
      supabase.from("students").select("id").eq("user_id", teacher.userId).maybeSingle(),
    ]);
    if (role?.role === "teacher" && !student) {
      const { error: authErr } = await supabase.auth.admin.deleteUser(teacher.userId);
      if (authErr) console.error("Failed to delete teacher login", teacher.userId, authErr);
    } else {
      console.warn("Kept login", teacher.userId, "for removed teacher", id, "— it isn't a plain teacher login.");
    }
  }

  return Response.json({ ok: true });
}
