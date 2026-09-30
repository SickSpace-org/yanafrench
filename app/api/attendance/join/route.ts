import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getViewer } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { markJoinAttendance } from "@/lib/attendance";

// Every "Join class" button in the student hub points here instead of
// straight at the meeting link. Records attendance (present, if this click
// falls inside a class's first 15 minutes — see lib/attendanceData.ts),
// then forwards to the meeting. Recording is best-effort: a failure here
// must never stop a student from getting into their class.
export async function GET(req: Request) {
  const state = await readPortalState();
  const meetingLink = state.zoomLink?.trim();
  const fallback = new URL("/student-hub/calendar", req.url).toString();

  try {
    const viewer = await getViewer();
    const supabase = getSupabaseAdmin();
    if (viewer?.role === "student" && supabase) {
      const { data: student } = await supabase.from("students").select("id").eq("user_id", viewer.userId).maybeSingle();
      if (student) {
        const { data: enrollments } = await supabase
          .from("batch_enrollments")
          .select("batch_id")
          .eq("student_id", student.id)
          .eq("status", "active");
        await markJoinAttendance(supabase, student.id, (enrollments ?? []).map((e) => e.batch_id), state.batches);
      }
    }
  } catch (err) {
    console.error("[attendance/join] Failed to record attendance", err);
  }

  return Response.redirect(meetingLink || fallback, 302);
}
