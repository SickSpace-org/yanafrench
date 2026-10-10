import { authErrorResponse } from "@/lib/auth";
import { MATERIAL_COLUMNS, materialFromRow } from "@/lib/batchContent";
import { deleteMaterialObject, headMaterial, MATERIAL_MAX_BYTES, MATERIAL_TYPES, materialKeyPrefix } from "@/lib/r2Private";
import { recordTeacherActivity } from "@/lib/teacherAudit";
import { cleanTitle } from "@/lib/teacherContentInput";
import { requireTeacher, type TeacherContext } from "@/lib/teachers";

// POST { batchId, key, title, fileName } → step 2 of a material upload:
// records the file uploaded in step 1. The key must sit directly in THIS
// batch's folder (also enforced by a check constraint on the table), and
// the object must really exist with an allowed type and size. If the row
// can't be saved, the uploaded object is deleted again.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }

  const key = typeof body?.key === "string" ? body.key : "";
  const title = cleanTitle(body?.title);
  const fileName = cleanTitle(body?.fileName, 255);
  if (!title || !fileName) return new Response("Add a title.", { status: 400 });
  const prefix = materialKeyPrefix(batchId);
  if (!key.startsWith(prefix) || key.includes("..") || key.slice(prefix.length).includes("/")) {
    return new Response("That file doesn't belong to this batch.", { status: 400 });
  }

  const head = await headMaterial(key);
  if (!head) return new Response("The upload didn't finish — please try again.", { status: 400 });
  if (!head.contentType || !MATERIAL_TYPES[head.contentType] || head.size <= 0 || head.size > MATERIAL_MAX_BYTES) {
    await deleteMaterialObject(key);
    return new Response("That file type or size isn't allowed.", { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await ctx.supabase
    .from("batch_materials")
    .insert({
      id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      batch_id: batchId,
      teacher_id: ctx.teacher.id,
      author_name: ctx.teacher.fullName,
      title,
      storage_key: key,
      file_name: fileName,
      content_type: head.contentType,
      size_bytes: head.size,
      created_at: now,
      updated_at: now,
    })
    .select(MATERIAL_COLUMNS)
    .single();
  if (error || !data) {
    // 23505: this key is already recorded — leave the object alone.
    if (error?.code === "23505") return new Response("That file is already saved.", { status: 409 });
    console.error("Failed to record material", batchId, error);
    await deleteMaterialObject(key);
    return new Response("Couldn't save the file.", { status: 500 });
  }
  await recordTeacherActivity(ctx.supabase, ctx.teacher, { batchId, contentType: "material", contentId: data.id, action: "created", title, detail: fileName });
  return Response.json(materialFromRow(data));
}
