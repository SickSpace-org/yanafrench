import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { AiMemberProvisionError, nextExpiry, provisionAiMember } from "@/lib/aiHub";
import { AI_HUB_MEMBER_COLUMNS, type AiHubMemberRow } from "@/lib/aiHubData";

// PATCH: the buttons on Admin -> Le Kiosque.
//   payment     "Payment received" — the first time this creates the login,
//               emails the one-time setup link and starts 30 days; every
//               later time it adds another 30 days (from the current expiry
//               if still running, so an early renewal loses nothing).
//   resend      a fresh setup link (also returned, to copy if email fails).
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
  if (!["payment", "resend", "deactivate", "reactivate"].includes(action)) {
    return new Response("Unknown action.", { status: 400 });
  }

  const { data, error } = await supabase.from("ai_hub_members").select(AI_HUB_MEMBER_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("Failed to load Le Kiosque member", id, error);
    return new Response("Failed to load the member.", { status: 500 });
  }
  const member = data as AiHubMemberRow | null;
  if (!member) return new Response("Member not found.", { status: 404 });

  const now = new Date().toISOString();
  const save = async (patch: Record<string, unknown>) => {
    const { error: updateErr } = await supabase
      .from("ai_hub_members")
      .update({ ...patch, updated_at: now })
      .eq("id", id);
    if (updateErr) throw updateErr;
  };

  try {
    if (action === "deactivate") {
      await save({ status: "deactivated" });
      return Response.json({ ok: true });
    }
    if (action === "reactivate") {
      if (!member.user_id) return new Response("This person hasn't been accepted yet — use Payment received.", { status: 409 });
      await save({ status: "active" });
      return Response.json({ ok: true });
    }
    if (action === "resend") {
      if (!member.user_id) return new Response("This person hasn't been accepted yet — use Payment received.", { status: 409 });
      const { setupUrl, emailSent } = await provisionAiMember(supabase, member.email, member.full_name);
      return Response.json({ ok: true, setupUrl, emailSent });
    }

    // payment
    let setupUrl: string | undefined;
    let emailSent: boolean | undefined;
    let userId = member.user_id;
    if (!userId) {
      const provisioned = await provisionAiMember(supabase, member.email, member.full_name);
      userId = provisioned.userId;
      setupUrl = provisioned.setupUrl;
      emailSent = provisioned.emailSent;
    }
    const expiresAt = nextExpiry(member.expires_at);
    await save({ status: "active", user_id: userId, expires_at: expiresAt });
    return Response.json({ ok: true, expiresAt, setupUrl, emailSent });
  } catch (err) {
    if (err instanceof AiMemberProvisionError) return new Response(err.message, { status: err.status });
    console.error("Failed to update Le Kiosque member", id, action, err);
    return new Response("Couldn't update the member. Check the server logs.", { status: 500 });
  }
}

// DELETE: remove a request or member. Also deletes their login, but only
// when it really is a plain ai_member login — never an admin's.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { data } = await supabase.from("ai_hub_members").select("user_id").eq("id", id).maybeSingle();
  if (!data) return new Response("Member not found.", { status: 404 });

  const { error } = await supabase.from("ai_hub_members").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete Le Kiosque member", id, error);
    return new Response("Failed to remove the member.", { status: 500 });
  }

  const userId = data.user_id as string | null;
  if (userId) {
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (roleRow?.role === "ai_member") {
      const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
      if (delErr) console.error("Removed Le Kiosque member but couldn't delete their login", userId, delErr);
    }
  }
  return Response.json({ ok: true });
}
