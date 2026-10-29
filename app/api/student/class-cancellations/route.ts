import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { viewerBatchIds } from "@/lib/classLinks";
import { getCancellations } from "@/lib/classCancellations";
import { todayInIndia } from "@/lib/emiData";
import type { ClassCancellation } from "@/lib/attendanceData";

// GET → { cancellations: [{ batchId, date, note }] } — cancelled classes
// from today on in the signed-in student's own batches (every batch for an
// admin previewing the hub), for the dashboard and calendar.
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ cancellations: [] });

  const { batchIds } = await viewerBatchIds(supabase, viewer);
  const cancellations: ClassCancellation[] = (await getCancellations(supabase, batchIds, { from: todayInIndia() })).map(({ batchId, date, note }) => ({
    batchId,
    date,
    note,
  }));
  return Response.json({ cancellations }, { headers: { "Cache-Control": "no-store" } });
}
