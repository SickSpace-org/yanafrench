import { authErrorResponse } from "@/lib/auth";
import { buildMaterialKey, getPrivateR2, MATERIAL_MAX_BYTES, MATERIAL_TYPES, presignMaterialUpload } from "@/lib/r2Private";
import { requireTeacher } from "@/lib/teachers";

// POST { batchId, fileName, contentType, size } → { key, uploadUrl }.
// Step 1 of a material upload: a 15-minute presigned PUT into the PRIVATE
// bucket, under batch-materials/<batchId>/. Type and size are checked here
// and baked into the signature. Step 2 is POST /api/teacher/materials.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  try {
    await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!getPrivateR2()) {
    return new Response("File uploads aren't switched on yet — ask Yana to set up the private materials bucket.", { status: 501 });
  }

  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  if (!fileName) return new Response("Missing file name.", { status: 400 });
  if (!MATERIAL_TYPES[contentType]) {
    return new Response("That file type isn't allowed. Use PDF, Word, PowerPoint, Excel, text, images or audio.", { status: 400 });
  }
  if (!Number.isInteger(size) || size <= 0 || size > MATERIAL_MAX_BYTES) {
    return new Response(`Files must be under ${MATERIAL_MAX_BYTES / (1024 * 1024)} MB.`, { status: 400 });
  }

  const key = buildMaterialKey(batchId, fileName);
  try {
    return Response.json({ key, uploadUrl: await presignMaterialUpload(key, contentType, size) });
  } catch (err) {
    console.error("Failed to presign material upload", batchId, err);
    return new Response("Couldn't prepare the upload.", { status: 500 });
  }
}
