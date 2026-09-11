import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "@/lib/r2";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// Mints a presigned PUT URL for one chunk of an in-progress multipart
// upload. The chunk's bytes go browser -> R2 directly; only this small
// signing request touches our server, so a video of any size never hits
// Vercel's request body limit.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const r2 = getR2Client();
  if (!r2) return new Response("R2 isn't configured.", { status: 501 });

  const { key, uploadId, partNumber } = await req.json().catch(() => ({}) as Record<string, unknown>);
  if (!key || !uploadId || !partNumber) {
    return new Response("key, uploadId, and partNumber are required.", { status: 400 });
  }

  try {
    const url = await getSignedUrl(
      r2.client,
      new UploadPartCommand({ Bucket: r2.bucket, Key: key as string, UploadId: uploadId as string, PartNumber: partNumber as number }),
      { expiresIn: 3600 }
    );
    return Response.json({ url });
  } catch (error) {
    console.error(error);
    return new Response("Unable to prepare the next chunk.", { status: 500 });
  }
}
