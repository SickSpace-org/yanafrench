import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rateLimit";
import { accessFor, type AiHubMemberRow } from "@/lib/aiHubData";

// POST: public. Someone on /kiosque asks to join. This only records the
// request (status 'pending', no login, no access) so Yana can match it to
// the WhatsApp payment and accept it in Admin -> Le Kiosque. Repeating the
// request for the same email just refreshes the details.
export async function POST(req: Request) {
  const allowed = await checkRateLimit(`aihub-request:${clientIp(req)}`, 8, 3600);
  if (!allowed) return rateLimitResponse();

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Signups aren't available right now.", { status: 501 });

  const body = await req.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const whatsapp = typeof body?.whatsapp === "string" ? body.whatsapp.trim().slice(0, 40) : "";
  if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response("Enter your name and a valid email.", { status: 400 });
  }

  const { data: existing, error: lookupErr } = await supabase
    .from("ai_hub_members")
    .select("id, status, expires_at")
    .eq("email", email)
    .maybeSingle();
  if (lookupErr) {
    console.error("Failed to look up Le Kiosque request", email, lookupErr);
    return new Response("Something went wrong. Please try again.", { status: 500 });
  }

  if (existing) {
    const row = existing as Pick<AiHubMemberRow, "id" | "status" | "expires_at">;
    if (accessFor(row.status, row.expires_at) === "active") {
      return new Response("This email already has an active Le Kiosque membership — just log in.", { status: 409 });
    }
    const { error } = await supabase
      .from("ai_hub_members")
      .update({ full_name: fullName, whatsapp, requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      console.error("Failed to refresh Le Kiosque request", email, error);
      return new Response("Something went wrong. Please try again.", { status: 500 });
    }
    return Response.json({ ok: true });
  }

  const id = `aim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { error } = await supabase.from("ai_hub_members").insert({ id, full_name: fullName, email, whatsapp });
  if (error) {
    console.error("Failed to save Le Kiosque request", email, error);
    return new Response("Something went wrong. Please try again.", { status: 500 });
  }
  return Response.json({ ok: true });
}
