import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { homeworkFromRow, type HomeworkRow } from "@/lib/homeworkData";

// The signed-in student's homework, for /student-hub/homework: everything
// sent to a batch they're actively enrolled in, newest first, each tagged
// with the batch name(s) it came through. An admin previewing the hub sees
// all homework so they can check how it looks.
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  let batchIds: string[] | null = null;
  if (viewer.role !== "admin") {
    const { data: student } = await supabase.from("students").select("id").eq("user_id", viewer.userId).maybeSingle();
    if (!student) return Response.json({ homework: [] });
    const { data: enrollments } = await supabase.from("batch_enrollments").select("batch_id").eq("student_id", student.id).eq("status", "active");
    batchIds = [...new Set((enrollments ?? []).map((e) => e.batch_id as string))];
    if (batchIds.length === 0) return Response.json({ homework: [] });
  }

  let query = supabase.from("homework").select("*").order("created_at", { ascending: false });
  if (batchIds) query = query.overlaps("batch_ids", batchIds);
  const [{ data, error }, state] = await Promise.all([query, readPortalState()]);
  if (error) {
    console.error("Failed to load student homework", error);
    return Response.json({ homework: [] });
  }

  const names = new Map(state.batches.map((b) => [b.id, `${b.course} · ${b.name}`]));
  const homework = ((data as HomeworkRow[]) ?? []).map((row) => {
    const hw = homeworkFromRow(row);
    const mine = batchIds ? hw.batchIds.filter((id) => batchIds!.includes(id)) : hw.batchIds;
    return {
      id: hw.id,
      title: hw.title,
      intro: hw.intro,
      sections: hw.sections,
      dueDate: hw.dueDate,
      createdAt: hw.createdAt,
      batches: mine.map((id) => names.get(id)).filter(Boolean),
    };
  });
  return Response.json({ homework });
}
