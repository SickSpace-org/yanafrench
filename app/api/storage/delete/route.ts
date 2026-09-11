import { deleteUploadedObject, extractUploadKey } from "@/lib/r2";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// Deletes the R2 object backing an uploaded video/PDF when an admin
// deletes or replaces it — without this, the admin panel only ever
// forgot the file's URL and the actual object sat in the bucket forever.
// Silently no-ops for a URL that isn't one of ours (an external link),
// and always returns ok so a cleanup failure never blocks the UI.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : null;
  if (!url) return Response.json({ ok: true });

  const key = extractUploadKey(url);
  if (!key) return Response.json({ ok: true });

  await deleteUploadedObject(key);
  return Response.json({ ok: true });
}
