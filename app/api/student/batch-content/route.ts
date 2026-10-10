import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { listBatchContent } from "@/lib/batchContent";
import { viewerBatchIds } from "@/lib/classLinks";
import { readPortalState } from "@/lib/portalStateServer";

// GET → recordings and materials shared by the teachers of the signed-in
// student's ACTIVE batches (every batch for an admin previewing the hub),
// plus each batch's name. Materials carry no URL — downloads go through
// /api/materials/[id]/download, which re-checks access.
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ recordings: [], materials: [], batchNames: {} });

  const [{ batchIds }, { batches }] = await Promise.all([viewerBatchIds(supabase, viewer), readPortalState()]);
  // Only batches that still exist — a deleted batch's content isn't shown.
  const existing = new Set(batches.map((b) => b.id));
  try {
    const content = await listBatchContent(supabase, batchIds ? batchIds.filter((id) => existing.has(id)) : null);
    const wanted = new Set([...content.recordings, ...content.materials].map((c) => c.batchId));
    const batchNames = Object.fromEntries(batches.filter((b) => wanted.has(b.id)).map((b) => [b.id, b.name]));
    return Response.json({ ...content, batchNames }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Failed to load batch content for student", err);
    return new Response("Failed to load class content.", { status: 500 });
  }
}
