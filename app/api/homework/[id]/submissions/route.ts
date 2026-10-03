import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { homeworkFromRow, homeworkSubmissionFromRow, type HomeworkRow, type HomeworkSubmissionRow } from "@/lib/homeworkData";
import { homeworkRecipients } from "@/lib/homework";

// GET: Admin → Homework's submissions view for homework X — every student
// it was sent to (active in one of its batches), with their answers or
// null, plus anyone who submitted and has since left those batches.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { data: row } = await supabase.from("homework").select("*").eq("id", id).maybeSingle();
  if (!row) return new Response("Homework not found.", { status: 404 });
  const homework = homeworkFromRow(row as HomeworkRow);

  const [recipients, { data: subRows }] = await Promise.all([
    homeworkRecipients(supabase, homework.batchIds),
    supabase.from("homework_submissions").select("*, students(name, email)").eq("homework_id", homework.id),
  ]);

  type SubJoin = HomeworkSubmissionRow & { students: { name: string; email: string } | null };
  const subs = new Map(((subRows as SubJoin[]) ?? []).map((r) => [r.student_id, r]));

  const students = recipients.map((r) => {
    const sub = subs.get(r.studentId);
    return { studentId: r.studentId, name: r.name, email: r.email, inBatch: true, submission: sub ? homeworkSubmissionFromRow(sub) : null };
  });
  const known = new Set(recipients.map((r) => r.studentId));
  for (const sub of subs.values()) {
    if (known.has(sub.student_id)) continue;
    students.push({
      studentId: sub.student_id,
      name: sub.students?.name ?? "Former student",
      email: sub.students?.email ?? "",
      inBatch: false,
      submission: homeworkSubmissionFromRow(sub),
    });
  }

  return Response.json({ homework, students });
}
