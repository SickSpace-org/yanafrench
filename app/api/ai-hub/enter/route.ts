import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rateLimit";
import { setMemberCookie } from "@/lib/aiHubSession";
import { findAdminUserIdByEmail } from "@/lib/aiHub";
import { accessFor, AI_HUB_MEMBER_COLUMNS, type AiHubMemberRow } from "@/lib/aiHubData";

// POST { email }: the "enter with your email" step. An admin's email always
// works. Otherwise, if that email belongs to
// a member whose payment Yana has confirmed (and whose month hasn't run out),
// a signed cookie is set and they can open Le Kiosque. Otherwise they're told
// why — still waiting on payment, expired, paused, or never signed up.
export async function POST(req: Request) {
  if (!(await checkRateLimit(`aihub-enter:${clientIp(req)}`, 30, 3600))) return rateLimitResponse();

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Le Kiosque isn't available right now.", { status: 501 });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return new Response("Enter a valid email address.", { status: 400 });

  // Admins (anyone with the admin role) go straight in with their own email.
  const adminId = await findAdminUserIdByEmail(email).catch(() => null);
  if (adminId) {
    await setMemberCookie(`admin-${adminId}`);
    return Response.json({ ok: true });
  }

  const { data, error } = await supabase.from("ai_hub_members").select(AI_HUB_MEMBER_COLUMNS).eq("email", email).maybeSingle();
  if (error) {
    console.error("Le Kiosque entry lookup failed", error);
    return new Response("Something went wrong. Please try again.", { status: 500 });
  }
  const row = data as AiHubMemberRow | null;
  if (!row) return new Response("We don't have a membership request for that email yet. Join first, then message Yana on WhatsApp.", { status: 404 });

  switch (accessFor(row.status, row.expires_at)) {
    case "active":
      await setMemberCookie(row.id);
      return Response.json({ ok: true });
    case "pending":
      return new Response("Your payment hasn't been confirmed yet. Once Yana confirms it, come back and enter your email.", { status: 403 });
    case "expired":
      return new Response("Your month has ended. Message Yana on WhatsApp to renew.", { status: 403 });
    default:
      return new Response("Your access is paused. Please message Yana.", { status: 403 });
  }
}
