import { authErrorResponse } from "@/lib/auth";
import { recordTeacherActivity } from "@/lib/teacherAudit";
import { cleanDate, cleanRecordingUrl, cleanTitle } from "@/lib/teacherContentInput";
import { RECORDING_COLUMNS, recordingFromRow } from "@/lib/batchContent";
import { requireTeacher, type TeacherContext } from "@/lib/teachers";

// POST { batchId, title, url, classDate? } → add a class recording LINK to
// one of the teacher's own batches. Students in the batch see it under
// Lessons -> Recordings, labelled with the teacher's name.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }

  const title = cleanTitle(body?.title);
  const url = cleanRecordingUrl(body?.url);
  const classDate = cleanDate(body?.classDate);
  if (!title || !url || classDate === undefined) {
    return new Response("Add a title, a valid http(s) link and (optionally) the class date.", { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await ctx.supabase
    .from("batch_recordings")
    .insert({
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      batch_id: batchId,
      teacher_id: ctx.teacher.id,
      author_name: ctx.teacher.fullName,
      title,
      url,
      class_date: classDate,
      created_at: now,
      updated_at: now,
    })
    .select(RECORDING_COLUMNS)
    .single();
  if (error || !data) {
    console.error("Failed to add recording", batchId, error);
    return new Response("Couldn't save the recording.", { status: 500 });
  }
  await recordTeacherActivity(ctx.supabase, ctx.teacher, { batchId, contentType: "recording", contentId: data.id, action: "created", title, detail: url });
  return Response.json(recordingFromRow(data));
}
