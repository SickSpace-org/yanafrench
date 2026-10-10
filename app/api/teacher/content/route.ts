import { authErrorResponse } from "@/lib/auth";
import { listBatchContent } from "@/lib/batchContent";
import { getPrivateR2 } from "@/lib/r2Private";
import { requireTeacher, type TeacherContext } from "@/lib/teachers";

// GET ?batchId=X → the recordings and materials of one of the teacher's own
// batches, plus whether file uploads are switched on (private bucket set).
export async function GET(req: Request) {
  const batchId = new URL(req.url).searchParams.get("batchId") ?? "";
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }
  try {
    const content = await listBatchContent(ctx.supabase, [batchId]);
    return Response.json({ ...content, uploadsEnabled: getPrivateR2() !== null });
  } catch (err) {
    console.error("Failed to load batch content", batchId, err);
    return new Response("Failed to load class content.", { status: 500 });
  }
}
