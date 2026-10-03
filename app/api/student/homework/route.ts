import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { homeworkFromRow, homeworkSubmissionFromRow, type HomeworkRow, type HomeworkSubmissionRow } from "@/lib/homeworkData";
import { studentHomeworkAccess } from "@/lib/homework";

// The signed-in student's homework, for /student-hub/homework: everything
// sent to a batch they're actively enrolled in, newest first, each tagged
// with the batch name(s) it came through and their own submission (if
// any). An admin previewing the hub sees all homework, never submissions.
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const access = await studentHomeworkAccess(supabase, viewer);
  if (!access) return Response.json({ homework: [], preview: false });
  const { studentId, batchIds } = access;

  let query = supabase.from("homework").select("*").order("created_at", { ascending: false });
  if (batchIds) query = query.overlaps("batch_ids", batchIds);
  const [{ data, error }, { data: subRows }, state] = await Promise.all([
    query,
    studentId ? supabase.from("homework_submissions").select("*").eq("student_id", studentId) : Promise.resolve({ data: [] }),
    readPortalState(),
  ]);
  if (error) {
    console.error("Failed to load student homework", error);
    return Response.json({ homework: [], preview: !studentId });
  }

  const submissions = new Map(((subRows as HomeworkSubmissionRow[]) ?? []).map((r) => [r.homework_id, homeworkSubmissionFromRow(r)]));
  const names = new Map(state.batches.map((b) => [b.id, `${b.course} · ${b.name}`]));
  const homework = ((data as HomeworkRow[]) ?? []).map((row) => {
    const hw = homeworkFromRow(row);
    const mine = batchIds ? hw.batchIds.filter((id) => batchIds.includes(id)) : hw.batchIds;
    const sub = submissions.get(hw.id);
    return {
      id: hw.id,
      title: hw.title,
      intro: hw.intro,
      sections: hw.sections,
      dueDate: hw.dueDate,
      createdAt: hw.createdAt,
      batches: mine.map((id) => names.get(id)).filter(Boolean),
      submission: sub ? { answers: sub.answers, submittedAt: sub.submittedAt, updatedAt: sub.updatedAt } : null,
    };
  });
  return Response.json({ homework, preview: !studentId });
}
