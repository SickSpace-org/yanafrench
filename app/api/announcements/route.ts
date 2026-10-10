import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { AnnouncementError, listBatchAnnouncements, sendAnnouncement } from "@/lib/announcements";
import { cleanAnnouncementBody } from "@/lib/announcementData";
import { readPortalState } from "@/lib/portalStateServer";

// Admin -> Announcements, for any batch.
// GET  ?batchId=X                    → every announcement there (teachers' too)
// POST { batchId, studentId?, body } → from "Yana" to the whole batch or one
//      student actively in it.

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);
  const batchId = new URL(req.url).searchParams.get("batchId") ?? "";
  if (!batchId) return new Response("Missing batchId.", { status: 400 });
  try {
    return Response.json(await listBatchAnnouncements(supabase, batchId));
  } catch (err) {
    console.error("Failed to list announcements", batchId, err);
    return new Response("Failed to load announcements.", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  const text = cleanAnnouncementBody(body?.body);
  if (!batchId || !text) return new Response("Pick a batch and write a message (up to 2000 characters).", { status: 400 });
  if (!(await readPortalState()).batches.some((b) => b.id === batchId)) return new Response("That batch doesn't exist.", { status: 404 });
  const studentId = typeof body?.studentId === "string" && body.studentId ? body.studentId : null;

  try {
    return Response.json(await sendAnnouncement(supabase, { batchId, studentId, sender: { type: "admin", name: "Yana" }, body: text }));
  } catch (err) {
    if (err instanceof AnnouncementError) return new Response(err.message, { status: 400 });
    console.error("Failed to send admin announcement", batchId, err);
    return new Response("Couldn't send the announcement.", { status: 500 });
  }
}
