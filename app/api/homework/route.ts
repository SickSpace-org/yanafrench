import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { cleanHomeworkDraft, homeworkFromRow, type HomeworkRow } from "@/lib/homeworkData";

// Admin → Homework.
// GET              → every homework sent, newest first
// POST { homework, batchIds, dueDate?, sourceText? } → send to those batches
// (DELETE lives in ./[id]/route.ts)

async function guard() {
  try {
    await requireAdmin();
  } catch (err) {
    return { error: authErrorResponse(err) };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return { error: new Response("Supabase isn't configured.", { status: 501 }) };
  return { supabase };
}

export async function GET() {
  const { supabase, error } = await guard();
  if (!supabase) return error;
  const [{ data, error: dbError }, { data: subs }, { data: enrollments }] = await Promise.all([
    supabase.from("homework").select("*").order("created_at", { ascending: false }),
    supabase.from("homework_submissions").select("homework_id"),
    supabase.from("batch_enrollments").select("student_id, batch_id").eq("status", "active"),
  ]);
  if (dbError) {
    console.error("Failed to list homework", dbError);
    return Response.json([]);
  }

  const submittedBy = new Map<string, number>();
  for (const s of subs ?? []) submittedBy.set(s.homework_id, (submittedBy.get(s.homework_id) ?? 0) + 1);
  const studentsInBatch = new Map<string, Set<string>>();
  for (const e of enrollments ?? []) {
    const set = studentsInBatch.get(e.batch_id) ?? new Set<string>();
    set.add(e.student_id);
    studentsInBatch.set(e.batch_id, set);
  }

  return Response.json(
    ((data as HomeworkRow[]) ?? []).map((row) => {
      const hw = homeworkFromRow(row);
      const recipients = new Set(hw.batchIds.flatMap((b) => [...(studentsInBatch.get(b) ?? [])]));
      return { ...hw, submittedCount: submittedBy.get(hw.id) ?? 0, recipientCount: recipients.size };
    })
  );
}

export async function POST(req: Request) {
  const { supabase, error } = await guard();
  if (!supabase) return error;

  const body = await req.json().catch(() => null);
  const draft = cleanHomeworkDraft(body?.homework);
  if (!draft) return new Response("The homework needs a title and at least one task.", { status: 400 });

  const state = await readPortalState();
  const known = new Set(state.batches.map((b) => b.id));
  const batchIds: string[] = Array.isArray(body?.batchIds) ? [...new Set<string>(body.batchIds.filter((id: unknown) => typeof id === "string" && known.has(id)))] : [];
  if (batchIds.length === 0) return new Response("Pick at least one batch to send it to.", { status: 400 });

  const dueDate = typeof body?.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : null;
  const sourceText = typeof body?.sourceText === "string" ? body.sourceText.slice(0, 12_000) : null;

  const row = {
    id: `hw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: draft.title,
    intro: draft.intro,
    sections: draft.sections,
    batch_ids: batchIds,
    due_date: dueDate,
    source_text: sourceText,
  };
  const { data, error: dbError } = await supabase.from("homework").insert(row).select("*").single();
  if (dbError) {
    console.error("Failed to save homework", dbError);
    return new Response("Failed to send.", { status: 500 });
  }
  return Response.json(homeworkFromRow(data as HomeworkRow));
}
