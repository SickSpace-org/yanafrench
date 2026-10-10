import { authErrorResponse } from "@/lib/auth";
import { readPortalState } from "@/lib/portalStateServer";
import { requireTeacher, teacherBatchIds, toTeacherBatch, type TeacherContext } from "@/lib/teachers";

// GET: the signed-in teacher's own profile and the batches assigned to them
// (schedule only — no students, no payment data). Only batches that are
// both in batch_teachers for this teacher and still exist in R2.
export async function GET() {
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher();
  } catch (err) {
    return authErrorResponse(err);
  }

  const { batches } = await readPortalState();
  const owned = new Set(await teacherBatchIds(ctx.supabase, ctx.teacher.id, batches));

  return Response.json({
    teacher: { fullName: ctx.teacher.fullName, email: ctx.teacher.email },
    batches: batches.filter((b) => owned.has(b.id)).map(toTeacherBatch),
  });
}
