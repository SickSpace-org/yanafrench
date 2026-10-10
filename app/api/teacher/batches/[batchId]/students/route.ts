import { authErrorResponse } from "@/lib/auth";
import { requireTeacher, teacherRoster, type TeacherContext } from "@/lib/teachers";

// GET: the roster of one of the signed-in teacher's own batches — name and
// avatar only. requireTeacher({ batchId }) refuses (403) any batch that
// isn't assigned to this teacher or no longer exists.
export async function GET(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    return Response.json({ students: await teacherRoster(ctx.supabase, batchId) });
  } catch (err) {
    console.error("Failed to load roster for batch", batchId, err);
    return new Response("Failed to load the roster.", { status: 500 });
  }
}
