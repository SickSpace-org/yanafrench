import { getViewer } from "@/lib/auth";
import { viewerCanSeeBatch } from "@/lib/batchContent";
import { signMaterialDownload } from "@/lib/r2Private";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET → 302 to a 5-minute signed download of a private batch material, for
// the admin, the batch's ACTIVE teacher, or a student ACTIVELY enrolled in
// that batch (lib/batchContent.ts viewerCanSeeBatch). Anyone else gets
// 401 / 403 — and the object sits in a private bucket with no public URL.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Not authenticated", { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { data: row } = await supabase.from("batch_materials").select("batch_id, storage_key, file_name").eq("id", id).maybeSingle();
  // Same answer for "doesn't exist" and "not yours", so ids can't be probed.
  if (!row || !(await viewerCanSeeBatch(supabase, viewer, row.batch_id as string))) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = await signMaterialDownload(row.storage_key as string, row.file_name as string);
  if (!url) return new Response("File downloads aren't available right now.", { status: 501 });
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
}
