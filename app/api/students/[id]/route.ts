import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { deleteUploadedObject } from "@/lib/r2";

// Per-user JSON documents in R2 (see lib/messageStore.ts, quizStore.ts,
// vocabStore.ts, speakingStore.ts).
const USER_DATA_PREFIXES = ["data/messages/", "data/quiz/", "data/vocab/", "data/speaking-history/"];

// DELETE: Admin → Students' Remove action. Deletes the student record
// (enrollments, EMIs, attendance and submissions cascade with it) and,
// when the linked login is a plain student account, that login and its
// R2 data too — otherwise a removed student could still sign in to an
// empty hub. An admin login that also has a student record is kept.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { data: student } = await supabase.from("students").select("user_id").eq("id", id).maybeSingle();

  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete student", id, error);
    return new Response("Failed to delete student.", { status: 500 });
  }

  const userId = (student?.user_id as string | null) ?? null;
  if (userId) {
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (role?.role !== "admin") {
      const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
      if (authErr) console.error("Failed to delete student login", userId, authErr);
      await Promise.all(USER_DATA_PREFIXES.map((prefix) => deleteUploadedObject(`${prefix}${userId}.json`)));
    }
  }

  return Response.json({ ok: true });
}
