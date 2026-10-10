import { authErrorResponse } from "@/lib/auth";
import { recordTeacherActivity } from "@/lib/teacherAudit";
import { cleanDate, cleanRecordingUrl, cleanTitle } from "@/lib/teacherContentInput";
import { RECORDING_COLUMNS, recordingFromRow } from "@/lib/batchContent";
import { requireTeacherForRow } from "@/lib/teachers";

// PATCH { title?, url?, classDate? } / DELETE — a recording in one of the
// teacher's own batches. The batch is taken from the stored row, never
// from the request, so a teacher can't reach another batch's recording.
async function load(params: Promise<{ id: string }>) {
  const { id } = await params;
  try {
    const found = await requireTeacherForRow<{ id: string; batch_id: string; title: string; url: string }>("batch_recordings", id, "id, batch_id, title, url");
    return found ?? new Response("Recording not found.", { status: 404 });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const loaded = await load(params);
  if (loaded instanceof Response) return loaded;
  const { ctx, row } = loaded;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const patch: Record<string, unknown> = {};
  if (body && "title" in body) {
    const t = cleanTitle(body.title);
    if (!t) return new Response("Add a title.", { status: 400 });
    patch.title = t;
  }
  if (body && "url" in body) {
    const u = cleanRecordingUrl(body.url);
    if (!u) return new Response("That doesn't look like a valid http(s) link.", { status: 400 });
    patch.url = u;
  }
  if (body && "classDate" in body) {
    const d = cleanDate(body.classDate);
    if (d === undefined) return new Response("Invalid class date.", { status: 400 });
    patch.class_date = d;
  }
  if (Object.keys(patch).length === 0) return new Response("Nothing to update.", { status: 400 });
  patch.updated_at = new Date().toISOString();

  const { data, error } = await ctx.supabase.from("batch_recordings").update(patch).eq("id", row.id).select(RECORDING_COLUMNS).single();
  if (error || !data) {
    console.error("Failed to update recording", row.id, error);
    return new Response("Couldn't save the recording.", { status: 500 });
  }
  await recordTeacherActivity(ctx.supabase, ctx.teacher, { batchId: row.batch_id, contentType: "recording", contentId: row.id, action: "updated", title: data.title, detail: data.url });
  return Response.json(recordingFromRow(data));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const loaded = await load(params);
  if (loaded instanceof Response) return loaded;
  const { ctx, row } = loaded;

  const { error } = await ctx.supabase.from("batch_recordings").delete().eq("id", row.id);
  if (error) {
    console.error("Failed to delete recording", row.id, error);
    return new Response("Couldn't delete the recording.", { status: 500 });
  }
  await recordTeacherActivity(ctx.supabase, ctx.teacher, { batchId: row.batch_id, contentType: "recording", contentId: row.id, action: "deleted", title: row.title, detail: row.url });
  return Response.json({ ok: true });
}
