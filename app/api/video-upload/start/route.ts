import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { buildUploadKey, getR2Client } from "@/lib/r2";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// Starts a multipart upload and returns the object key + uploadId the
// client uses for every subsequent part-url/complete/abort call. Videos go
// through this instead of a single presigned PUT (see /api/upload) because
// a single PUT has no way to retry just the part that failed — one dropped
// packet on a multi-hundred-MB file means starting over from zero.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const r2 = getR2Client();
  if (!r2) {
    return new Response(
      "R2 isn't configured yet — set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME.",
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => null);
  const filename = typeof body?.filename === "string" && body.filename ? body.filename : "video";
  const contentType = typeof body?.contentType === "string" && body.contentType ? body.contentType : "video/mp4";

  const key = buildUploadKey(filename);

  try {
    const result = await r2.client.send(
      new CreateMultipartUploadCommand({ Bucket: r2.bucket, Key: key, ContentType: contentType })
    );
    if (!result.UploadId) return new Response("R2 did not return an upload id.", { status: 500 });
    return Response.json({ key, uploadId: result.UploadId });
  } catch (error) {
    console.error(error);
    return new Response("Unable to start the upload.", { status: 500 });
  }
}
