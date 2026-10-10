import { applyPortalAction, type PortalStateAction } from "@/lib/portalState";
import { readPortalState, writePortalState } from "@/lib/portalStateServer";
import { validateSlots } from "@/lib/batchData";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

  // A batch's schedule must be valid before it's stored: at least one slot,
  // real days and times, and no weekday in two slots (one class per day).
  const slots =
    action.type === "addBatch" ? action.batch?.slots : action.type === "updateBatch" && action.patch && "slots" in action.patch ? action.patch.slots : undefined;
  if (action.type === "addBatch" || slots !== undefined) {
    const problem = validateSlots(slots);
    if (problem) return new Response(problem, { status: 400 });
  }

  const existing = await readPortalState();
  const next = applyPortalAction(existing, action);
  if (next === existing) {
    return new Response("Unknown action", { status: 400 });
  }

  const saved = await writePortalState(next);
  if (!saved) {
    return new Response("Not persisted — R2 isn't configured.", { status: 501 });
  }

  // A deleted batch hands its teacher assignment back too. Best-effort:
  // teacher reads already ignore assignments to batches that no longer
  // exist, so a failure here never grants anything.
  if (action.type === "removeBatch") {
    const { error } = (await getSupabaseAdmin()?.from("batch_teachers").delete().eq("batch_id", action.id)) ?? {};
    if (error) console.error("Failed to clear teacher assignment for removed batch", action.id, error);
  }

  return Response.json(next);
}
