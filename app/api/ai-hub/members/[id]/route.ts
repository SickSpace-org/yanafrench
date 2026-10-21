import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { nextExpiry } from "@/lib/aiHub";
import { sendAiHubWelcomeEmail } from "@/lib/email";
import { AI_HUB_MEMBER_COLUMNS, type AiHubMemberRow } from "@/lib/aiHubData";

// PATCH: the buttons on Admin -> Le Kiosque.
//   payment     "Payment received" — activates the member and adds 30 days
//               (from the current expiry if still running, so an early
//               renewal loses nothing). The first time, they're emailed that
//               they can now enter with their email.
//   deactivate  / reactivate   pause access without losing anything.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (!["payment", "deactivate", "reactivate"].includes(action)) {
    return new Response("Unknown action.", { status: 400 });
  }

  const { data, error } = await supabase.from("ai_hub_members").select(AI_HUB_MEMBER_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("Failed to load Le Kiosque member", id, error);
    return new Response("Failed to load the member.", { status: 500 });
  }
  const member = data as AiHubMemberRow | null;
  if (!member) return new Response("Member not found.", { status: 404 });

  const save = async (patch: Record<string, unknown>) => {
    const { error: updateErr } = await supabase
      .from("ai_hub_members")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateErr) throw updateErr;
  };

  try {
    if (action === "deactivate") {
      await save({ status: "deactivated" });
      return Response.json({ ok: true });
    }
    if (action === "reactivate") {
      if (!member.expires_at) return new Response("This person hasn't paid yet — use Payment received.", { status: 409 });
      await save({ status: "active" });
      return Response.json({ ok: true });
    }

    // payment
    const firstTime = member.expires_at === null;
    const expiresAt = nextExpiry(member.expires_at);
    await save({ status: "active", expires_at: expiresAt });
    // Best-effort: a failed email never undoes the payment.
    const emailSent = firstTime ? await sendAiHubWelcomeEmail(member.email, member.full_name).catch(() => false) : undefined;
    return Response.json({ ok: true, expiresAt, emailSent });
  } catch (err) {
    console.error("Failed to update Le Kiosque member", id, action, err);
    return new Response("Couldn't update the member. Check the server logs.", { status: 500 });
  }
}

// DELETE: remove a request or member, along with their saved words, quiz
// history and pronunciation attempts.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { data } = await supabase.from("ai_hub_members").select("id").eq("id", id).maybeSingle();
  if (!data) return new Response("Member not found.", { status: 404 });

  await Promise.all(
    ["ai_hub_words", "ai_hub_quizzes", "ai_hub_pronunciations"].map((table) => supabase.from(table).delete().eq("user_id", id))
  );
  const { error } = await supabase.from("ai_hub_members").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete Le Kiosque member", id, error);
    return new Response("Failed to remove the member.", { status: 500 });
  }
  return Response.json({ ok: true });
}
