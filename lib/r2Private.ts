import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Server-only. A SECOND, PRIVATE R2 bucket for per-batch teacher materials
// (R2_PRIVATE_BUCKET_NAME, same Cloudflare account and keys as lib/r2.ts).
// The main bucket's public r2.dev domain serves every object in it, so
// private files can never go there. Nothing here returns a permanent URL:
// downloads are short-lived signed GETs issued after an access check
// (app/api/materials/[id]/download).
//
// Returns null — and material uploads stay switched off — until the bucket
// is configured, and also if it's (mis)set to the public bucket's name.

export const MATERIAL_MAX_BYTES = 50 * 1024 * 1024;

// What a teacher may upload: documents, slides, sheets, images, audio.
export const MATERIAL_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "text/plain": "TXT",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
  "audio/mpeg": "MP3",
  "audio/mp4": "M4A",
  "audio/x-m4a": "M4A",
  "audio/wav": "WAV",
};

export function getPrivateR2(): { client: S3Client; bucket: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PRIVATE_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  if (bucket === process.env.R2_BUCKET_NAME) {
    console.error("R2_PRIVATE_BUCKET_NAME is the public bucket — refusing to store private materials there.");
    return null;
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket };
}

export function materialKeyPrefix(batchId: string): string {
  return `batch-materials/${batchId}/`;
}

export function buildMaterialKey(batchId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^[.-]+/, "").slice(-120) || "file";
  return `${materialKeyPrefix(batchId)}${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}`;
}

// Presigned PUT for the browser to upload straight to the private bucket.
// Content-Length is signed by default; Content-Type is only signed because
// it's listed in signableHeaders — so the upload must be exactly the type
// and size that were checked here, or R2 refuses it (403).
export async function presignMaterialUpload(key: string, contentType: string, size: number): Promise<string> {
  const r2 = getPrivateR2();
  if (!r2) throw new Error("Private bucket isn't configured.");
  return getSignedUrl(r2.client, new PutObjectCommand({ Bucket: r2.bucket, Key: key, ContentType: contentType, ContentLength: size }), {
    expiresIn: 15 * 60,
    signableHeaders: new Set(["content-type"]),
  });
}

export async function headMaterial(key: string): Promise<{ size: number; contentType: string | null } | null> {
  const r2 = getPrivateR2();
  if (!r2) return null;
  try {
    const head = await r2.client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
    return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? null };
  } catch {
    return null;
  }
}

export async function deleteMaterialObject(key: string): Promise<void> {
  const r2 = getPrivateR2();
  if (!r2) return;
  try {
    await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
  } catch (err) {
    console.error("Failed to delete private material object", key, err);
  }
}

// A 5-minute signed download link that saves under the original file name.
export async function signMaterialDownload(key: string, fileName: string): Promise<string | null> {
  const r2 = getPrivateR2();
  if (!r2) return null;
  const disposition = `attachment; filename="${fileName.replace(/["\\\r\n]/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  return getSignedUrl(r2.client, new GetObjectCommand({ Bucket: r2.bucket, Key: key, ResponseContentDisposition: disposition }), {
    expiresIn: 5 * 60,
  });
}
