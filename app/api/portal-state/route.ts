import { writeJson } from "@/lib/r2";
import { applyPortalAction, PORTAL_STATE_KEY, type PortalStateAction } from "@/lib/portalState";
import { readPortalState } from "@/lib/portalStateServer";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// GET: public — the student Lessons/Batches/Calendar pages (and the public
// batch finder) read this state without being signed in.
export async function GET() {
  return Response.json(await readPortalState());
}

// POST: every action here (course/recording/resource/batch edits, zoom
// link, teacher note, word of week, quiz level) is only ever sent by the
// admin panel — see lib/usePortalState.ts.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const action = (await req.json().catch(() => null)) as PortalStateAction | null;
  if (!action || typeof action !== "object" || !("type" in action)) {
    return new Response("Invalid action", { status: 400 });
  }

  const existing = await readPortalState();
  const next = applyPortalAction(existing, action);
  if (next === existing) {
    return new Response("Unknown action", { status: 400 });
  }

  const saved = await writeJson(PORTAL_STATE_KEY, next);
  if (!saved) {
    return new Response("Not persisted — R2 isn't configured.", { status: 501 });
  }

  return Response.json(next);
}
