import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getViewer } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { markJoinAttendance } from "@/lib/attendance";
import { openSessionDate } from "@/lib/attendanceData";
import { getClassLinks, viewerBatchIds } from "@/lib/classLinks";

// Every "Join class" button in the student hub points here instead of
// straight at the meeting link. Records attendance (present, if this click
// falls inside a class's join window — see lib/attendanceData.ts), then
// forwards to the class link: ?batch=X's own link (Admin → Attendance) if
// the viewer is in that batch, else the batch whose class is on right now,
// else any of their batches with a link, else the global Zoom link.
// Recording is best-effort: a failure here must never stop a student from
// getting into their class.
export async function GET(req: Request) {
  const state = await readPortalState();
  const fallback = new URL("/student-hub/calendar", req.url).toString();
  const requested = new URL(req.url).searchParams.get("batch");
  let meetingLink = state.zoomLink?.trim() || null;

  try {
    const viewer = await getViewer();
    const supabase = getSupabaseAdmin();
    if (viewer && (viewer.role === "student" || viewer.role === "admin") && supabase) {
      const { studentId, batchIds } = await viewerBatchIds(supabase, viewer);
      const mine = batchIds ?? state.batches.map((b) => b.id);
      const links = await getClassLinks(supabase, mine);

      const target =
        (requested && mine.includes(requested) ? requested : null) ??
        mine.find((id) => {
          const batch = state.batches.find((b) => b.id === id);
          return batch && openSessionDate(batch) && links[id];
        }) ??
        mine.find((id) => links[id]) ??
        null;
      if (target && links[target]) meetingLink = links[target];

      if (viewer.role === "student" && studentId && batchIds) {
        await markJoinAttendance(supabase, studentId, batchIds, state.batches);
      }
    }
  } catch (err) {
    console.error("[attendance/join] Failed to record attendance", err);
  }

  return Response.redirect(meetingLink || fallback, 302);
}
