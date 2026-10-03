import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { getClassLinks, viewerBatchIds } from "@/lib/classLinks";

// GET → { links: { [batchId]: url } } — the class links for the signed-in
// student's own batches (every batch for an admin previewing the hub).
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ links: {} });

  const { batchIds } = await viewerBatchIds(supabase, viewer);
  return Response.json({ links: await getClassLinks(supabase, batchIds) }, { headers: { "Cache-Control": "no-store" } });
}
