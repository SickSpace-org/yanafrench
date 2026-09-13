import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, resolveFileUrl } from "@/lib/r2";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";

// Presigned direct-to-R2 upload for a student's own profile photo — same
// pattern as app/api/upload (admin content), scoped to the caller's own
// account instead. The client PUTs the file, then saves the returned
// fileUrl via PATCH /api/student/me.
export async function POST(req: Request) {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  if (viewer.role === "admin") {
    return new Response("Admins have no student profile photo.", { status: 400 });
  }

  const r2 = getR2Client();
  if (!r2) {
    return new Response("R2 isn't configured yet.", { status: 501 });
  }

  const body = await req.json().catch(() => null);
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  if (!contentType.startsWith("image/")) {
    return new Response("Only image files are allowed for a profile photo.", { status: 400 });
  }
  const ext = contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
  const key = `avatars/${viewer.userId}-${Date.now()}.${ext}`;

  try {
    const uploadUrl = await getSignedUrl(
      r2.client,
      new PutObjectCommand({ Bucket: r2.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 3600 }
    );
    const fileUrl = await resolveFileUrl(key);
    return Response.json({ uploadUrl, fileUrl });
  } catch (error) {
    console.error(error);
    return new Response("Couldn't prepare the upload.", { status: 500 });
  }
}
