import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { studentSessions } from "@/lib/attendance";

// The signed-in student's own class attendance, for /student-hub/attendance.
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }
  if (viewer.role === "admin") return Response.json({ sessions: [] });

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", viewer.userId).maybeSingle();
  if (!student) return Response.json({ sessions: [] });

  const [{ data: enrollments }, state] = await Promise.all([
    supabase.from("batch_enrollments").select("batch_id, enrolled_at").eq("student_id", student.id).eq("status", "active"),
    readPortalState(),
  ]);

  const sessions = await studentSessions(
    supabase,
    student.id,
    (enrollments ?? []).map((e) => ({ batchId: e.batch_id, enrolledAt: e.enrolled_at })),
    state.batches
  );
  return Response.json({ sessions });
}
