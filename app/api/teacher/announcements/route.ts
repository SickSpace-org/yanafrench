import { authErrorResponse } from "@/lib/auth";
import { AnnouncementError, listBatchAnnouncements, sendAnnouncement } from "@/lib/announcements";
import { cleanAnnouncementBody } from "@/lib/announcementData";
import { recordTeacherActivity } from "@/lib/teacherAudit";
import { requireTeacher, type TeacherContext } from "@/lib/teachers";

// Teacher announcements for one of the teacher's own batches.
// GET  ?batchId=X                    → this teacher's own announcements there
// POST { batchId, studentId?, body } → to the whole batch (no studentId) or
//      one student actively in it. Permanent; logged for the admin.

export async function GET(req: Request) {
  const batchId = new URL(req.url).searchParams.get("batchId") ?? "";
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }
  try {
    return Response.json(await listBatchAnnouncements(ctx.supabase, batchId, { teacherId: ctx.teacher.id }));
  } catch (err) {
    console.error("Failed to list teacher announcements", batchId, err);
    return new Response("Failed to load announcements.", { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }

  const text = cleanAnnouncementBody(body?.body);
  if (!text) return new Response("Write a message (up to 2000 characters).", { status: 400 });
  const studentId = typeof body?.studentId === "string" && body.studentId ? body.studentId : null;

  try {
    const sent = await sendAnnouncement(ctx.supabase, {
      batchId,
      studentId,
      sender: { type: "teacher", teacherId: ctx.teacher.id, name: ctx.teacher.fullName },
      body: text,
    });
    await recordTeacherActivity(ctx.supabase, ctx.teacher, {
      batchId,
      contentType: "announcement",
      contentId: sent.id,
      action: "created",
      title: studentId ? "To one student" : "To the whole batch",
      detail: text.length > 300 ? `${text.slice(0, 300)}…` : text,
    });
    return Response.json(sent);
  } catch (err) {
    if (err instanceof AnnouncementError) return new Response(err.message, { status: 400 });
    console.error("Failed to send teacher announcement", batchId, err);
    return new Response("Couldn't send the announcement.", { status: 500 });
  }
}
