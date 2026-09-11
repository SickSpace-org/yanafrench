import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getR2Client, resolveFileUrl } from "@/lib/r2";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

type PartInput = { partNumber: number; etag: string };

// Finalizes a multipart upload once every chunk has been PUT to R2, then
// hands back the same kind of playable URL /api/upload returns for a
// direct-PUT file.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const r2 = getR2Client();
  if (!r2) return new Response("R2 isn't configured.", { status: 501 });

  const { key, uploadId, parts } = (await req.json().catch(() => ({}))) as {
    key?: string;
    uploadId?: string;
    parts?: PartInput[];
  };
  if (!key || !uploadId || !parts?.length) {
    return new Response("key, uploadId, and parts are required.", { status: 400 });
  }

  try {
    await r2.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: r2.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts].sort((a, b) => a.partNumber - b.partNumber).map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      })
    );
    const fileUrl = await resolveFileUrl(key);
    return Response.json({ fileUrl });
  } catch (error) {
    console.error(error);
    return new Response("Unable to finish the upload.", { status: 500 });
  }
}
