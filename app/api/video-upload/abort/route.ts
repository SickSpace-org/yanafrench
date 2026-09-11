import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// Cancels an in-progress multipart upload (user hit Cancel, or a chunk
// failed past retries) so R2 doesn't keep billing for the abandoned parts.
// Best-effort: always returns ok so a cleanup failure never blocks the UI
// from resetting.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const r2 = getR2Client();
  if (!r2) return Response.json({ ok: true });

  const { key, uploadId } = await req.json().catch(() => ({}) as Record<string, unknown>);
  if (!key || !uploadId) return Response.json({ ok: true });

  try {
    await r2.client.send(new AbortMultipartUploadCommand({ Bucket: r2.bucket, Key: key as string, UploadId: uploadId as string }));
  } catch (error) {
    console.error(error);
  }
  return Response.json({ ok: true });
}
