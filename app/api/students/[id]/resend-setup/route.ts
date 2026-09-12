import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { provisionStudentAccount } from "@/lib/studentAccount";
import type { StudentRow } from "@/lib/studentData";

// POST: Admin -> Students' "Send/resend setup link" action. Works the same
// way whether the student already has a linked account (regenerates and
// re-sends a fresh recovery link) or doesn't yet — e.g. one of the 3
// students that existed before this system was built (see
// db/phase3-student-accounts.sql). This is the deliberate, one-at-a-time
// action that backfills them; nothing does that automatically.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { data: row, error } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("Failed to load student for resend-setup", id, error);
    return new Response("Failed to load student.", { status: 500 });
  }
  if (!row) return new Response("Student not found.", { status: 404 });

  const student = row as StudentRow;
  const provisioned = await provisionStudentAccount(student.email);
  if (!provisioned) {
    return new Response("Couldn't provision or email the setup link. Check the server logs.", { status: 500 });
  }

  if (student.user_id !== provisioned.userId) {
    const { error: linkErr } = await supabase
      .from("students")
      .update({ user_id: provisioned.userId })
      .eq("id", id);
    if (linkErr) console.error("Failed to link student to auth user", id, linkErr);
  }

  return Response.json({ ok: true, emailSent: provisioned.emailSent });
}
