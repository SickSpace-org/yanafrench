import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { cleanHomeworkAnswers, homeworkFromRow, homeworkSubmissionFromRow, type HomeworkRow, type HomeworkSubmissionRow } from "@/lib/homeworkData";
import { studentHomeworkAccess } from "@/lib/homework";
import { checkHomeworkAnswers } from "@/lib/homeworkCheck";

// POST { answers } → submit (or resubmit) the signed-in student's answers
// to homework X, then have the AI check them and return its feedback.
// Only for homework sent to one of their active batches — or any homework
// for an admin with a linked student record, who is treated as enrolled
// in every batch.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  const allowed = await checkRateLimit(`homework-submit:${viewer.userId}`, 30, 600);
  if (!allowed) return rateLimitResponse();

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const access = await studentHomeworkAccess(supabase, viewer);
  if (!access) return new Response("Homework not found.", { status: 404 });
  const { studentId, batchIds } = access;
  if (!studentId) return new Response("You're previewing as admin — students submit from their own account.", { status: 403 });

  const { id } = await params;
  const { data: row } = await supabase.from("homework").select("*").eq("id", id).maybeSingle();
  const homework = row ? homeworkFromRow(row as HomeworkRow) : null;
  if (!homework || (batchIds && !homework.batchIds.some((b) => batchIds.includes(b)))) {
    return new Response("Homework not found.", { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const answers = cleanHomeworkAnswers(homework.sections, body?.answers);
  if (!answers) return new Response("Write at least one answer before submitting.", { status: 400 });

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("homework_submissions")
    .select("id")
    .eq("homework_id", homework.id)
    .eq("student_id", studentId)
    .maybeSingle();

  const result = existing
    ? await supabase.from("homework_submissions").update({ answers, updated_at: now }).eq("id", existing.id).select("*").single()
    : await supabase
        .from("homework_submissions")
        .upsert(
          { id: `hws-${homework.id}-${studentId}`, homework_id: homework.id, student_id: studentId, answers, submitted_at: now, updated_at: now },
          { onConflict: "homework_id,student_id" }
        )
        .select("*")
        .single();
  if (result.error) {
    console.error("Failed to save homework submission", homework.id, result.error);
    return new Response("Couldn't submit — please try again.", { status: 500 });
  }
  const sub = homeworkSubmissionFromRow(result.data as HomeworkSubmissionRow);

  // Answers are safe; now the AI check. Best-effort — if it fails the
  // student still sees "Submitted", just without feedback.
  const feedback = await checkHomeworkAnswers(homework, answers);
  const { error: fbErr } = await supabase.from("homework_submissions").update({ feedback }).eq("id", sub.id);
  if (fbErr) console.error("Failed to save homework feedback", sub.id, fbErr);

  return Response.json({
    submission: { answers: sub.answers, feedback: fbErr ? null : feedback, submittedAt: sub.submittedAt, updatedAt: sub.updatedAt },
  });
}
