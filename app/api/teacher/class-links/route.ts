import { authErrorResponse } from "@/lib/auth";
import { cleanClassLink, getClassLinks, setClassLink } from "@/lib/classLinks";
import { recordTeacherActivity } from "@/lib/teacherAudit";
import { requireTeacher, type TeacherContext } from "@/lib/teachers";

// The class link (Zoom / Meet / …) of one of the teacher's own batches —
// same class_links row Admin -> Attendance edits (lib/classLinks.ts).
// GET ?batchId=X       → { url }
// PUT { batchId, url } → set it; an empty url removes it. Logged to the
//                        admin's content activity.

export async function GET(req: Request) {
  const batchId = new URL(req.url).searchParams.get("batchId") ?? "";
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }
  const links = await getClassLinks(ctx.supabase, [batchId]);
  return Response.json({ url: links[batchId] ?? null });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as { batchId?: unknown; url?: unknown } | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  let ctx: TeacherContext;
  try {
    ctx = await requireTeacher({ batchId });
  } catch (err) {
    return authErrorResponse(err);
  }

  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  const url = cleanClassLink(raw);
  if (raw && !url) return new Response("That doesn't look like a valid link.", { status: 400 });

  const before = (await getClassLinks(ctx.supabase, [batchId]))[batchId] ?? null;
  const { error } = await setClassLink(ctx.supabase, batchId, url);
  if (error) {
    console.error("Failed to save class link", batchId, error);
    return new Response("Couldn't save the link.", { status: 500 });
  }
  if (before !== url) {
    await recordTeacherActivity(ctx.supabase, ctx.teacher, {
      batchId,
      contentType: "class_link",
      contentId: batchId,
      action: !url ? "deleted" : before ? "updated" : "created",
      title: "Class link",
      detail: url ?? before,
    });
  }
  return Response.json({ url });
}
