import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { listStudentAnnouncements } from "@/lib/announcements";

// The signed-in student's announcements (whole-batch ones of their active
// batches since they joined, plus ones addressed to them alone).
// GET  → { announcements, seenAt }  (an admin previewing the hub gets none)
// POST → marks them all seen (opening Notifications), clearing the dot.

async function studentIdFor(viewer: Viewer) {
  const supabase = getSupabaseAdmin();
  if (!supabase || viewer.role !== "student") return { supabase, studentId: null };
  const { data } = await supabase.from("students").select("id").eq("user_id", viewer.userId).maybeSingle();
  return { supabase, studentId: (data?.id as string | undefined) ?? null };
}

export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }
  const { supabase, studentId } = await studentIdFor(viewer);
  if (!supabase || !studentId) return Response.json({ announcements: [], seenAt: null });

  try {
    const [announcements, { data: seen }] = await Promise.all([
      listStudentAnnouncements(supabase, studentId),
      supabase.from("announcement_seen").select("seen_at").eq("student_id", studentId).maybeSingle(),
    ]);
    return Response.json({ announcements, seenAt: (seen?.seen_at as string | undefined) ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Failed to load announcements for student", studentId, err);
    return new Response("Failed to load announcements.", { status: 500 });
  }
}

export async function POST() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }
  const { supabase, studentId } = await studentIdFor(viewer);
  if (!supabase || !studentId) return Response.json({ ok: true });

  const { error } = await supabase
    .from("announcement_seen")
    .upsert({ student_id: studentId, seen_at: new Date().toISOString() }, { onConflict: "student_id" });
  if (error) console.error("Failed to mark announcements seen", studentId, error);
  return Response.json({ ok: true });
}
