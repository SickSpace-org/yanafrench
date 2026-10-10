import { authErrorResponse } from "@/lib/auth";
import { MATERIAL_COLUMNS, materialFromRow } from "@/lib/batchContent";
import { deleteMaterialObject } from "@/lib/r2Private";
import { recordTeacherActivity } from "@/lib/teacherAudit";
import { cleanTitle } from "@/lib/teacherContentInput";
import { requireTeacherForRow } from "@/lib/teachers";

// PATCH { title } (rename only — replacing a file is delete + upload) /
// DELETE — a material in one of the teacher's own batches. The batch comes
// from the stored row (lib/teachers.ts requireTeacherForRow).
type Row = { id: string; batch_id: string; title: string; file_name: string; storage_key: string };

async function load(params: Promise<{ id: string }>) {
  const { id } = await params;
  try {
    const found = await requireTeacherForRow<Row>("batch_materials", id, "id, batch_id, title, file_name, storage_key");
    return found ?? new Response("File not found.", { status: 404 });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const loaded = await load(params);
  if (loaded instanceof Response) return loaded;
  const { ctx, row } = loaded;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = cleanTitle(body?.title);
  if (!title) return new Response("Add a title.", { status: 400 });

  const { data, error } = await ctx.supabase
    .from("batch_materials")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .select(MATERIAL_COLUMNS)
    .single();
  if (error || !data) {
    console.error("Failed to rename material", row.id, error);
    return new Response("Couldn't rename the file.", { status: 500 });
  }
  await recordTeacherActivity(ctx.supabase, ctx.teacher, { batchId: row.batch_id, contentType: "material", contentId: row.id, action: "updated", title, detail: row.file_name });
  return Response.json(materialFromRow(data));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const loaded = await load(params);
  if (loaded instanceof Response) return loaded;
  const { ctx, row } = loaded;

  const { error } = await ctx.supabase.from("batch_materials").delete().eq("id", row.id);
  if (error) {
    console.error("Failed to delete material", row.id, error);
    return new Response("Couldn't delete the file.", { status: 500 });
  }
  await deleteMaterialObject(row.storage_key);
  await recordTeacherActivity(ctx.supabase, ctx.teacher, { batchId: row.batch_id, contentType: "material", contentId: row.id, action: "deleted", title: row.title, detail: row.file_name });
  return Response.json({ ok: true });
}
