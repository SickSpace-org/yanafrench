// Server-only. Access control and helpers for Le Kiosque — the standalone
// paid product (role 'ai_member'). Access = an ai_member login whose
// ai_hub_members row is 'active' with a future expires_at; admins can also
// use it (to preview). Checked from the database on every request, never
// from the JWT alone, so a lapsed or deactivated member is cut off at once.

import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthError, getViewer, type Viewer } from "./auth";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { findUserByEmail } from "./studentAccount";
import { sendAiHubWelcomeEmail } from "./email";
import { checkRateLimit } from "./rateLimit";
import {
  AI_HUB_MEMBER_COLUMNS,
  AI_HUB_PERIOD_DAYS,
  accessFor,
  daysUntil,
  type AiHubAccess,
  type AiHubMemberRow,
} from "./aiHubData";
import { SITE_URL } from "./site";

export type AiHubSession =
  | { kind: "active"; viewer: Viewer; isAdmin: boolean; daysLeft: number; name: string }
  | { kind: "blocked"; reason: Exclude<AiHubAccess, "active">; viewer: Viewer }
  | { kind: "none" };

export async function getAiHubSession(): Promise<AiHubSession> {
  const viewer = await getViewer();
  if (!viewer) return { kind: "none" };

  if (viewer.role === "admin") {
    return { kind: "active", viewer, isAdmin: true, daysLeft: 0, name: "Admin preview" };
  }
  if (viewer.role !== "ai_member") return { kind: "none" };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { kind: "none" };
  const { data } = await supabase
    .from("ai_hub_members")
    .select(AI_HUB_MEMBER_COLUMNS)
    .eq("user_id", viewer.userId)
    .maybeSingle();
  const row = data as AiHubMemberRow | null;
  if (!row) return { kind: "none" };

  const access = accessFor(row.status, row.expires_at);
  if (access !== "active") return { kind: "blocked", reason: access, viewer };
  return { kind: "active", viewer, isAdmin: false, daysLeft: daysUntil(row.expires_at), name: row.full_name };
}

// Guard for every /api/ai-hub/* member route. Throws AuthError (401 when
// signed out, 403 when not allowed or the subscription has lapsed).
export async function requireAiMember(): Promise<Viewer> {
  const session = await getAiHubSession();
  if (session.kind === "active") return session.viewer;
  throw new AuthError(session.kind === "none" ? 401 : 403);
}

// Per-member daily cap on a costly AI feature. Returns false when exceeded.
export function aiLimit(userId: string, feature: string, perDay: number): Promise<boolean> {
  return checkRateLimit(`aihub-${feature}:${userId}`, perDay, 86_400);
}

// "Today" for the daily quiz and news. The audience is Canadian, so the day
// rolls over at midnight Toronto time (YYYY-MM-DD).
export function aiHubToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// New expiry after a payment: 30 days from now, or from the current expiry
// if the member renews early (so no paid days are lost).
export function nextExpiry(current: string | null, now = Date.now()): string {
  const base = current && new Date(current).getTime() > now ? new Date(current).getTime() : now;
  return new Date(base + AI_HUB_PERIOD_DAYS * 86_400_000).toISOString();
}

export class AiMemberProvisionError extends Error {
  constructor(message: string, public status: number = 409) {
    super(message);
  }
}

// Finds or creates the login for a paying member, gives it the ai_member
// role (never changing an existing admin/student/teacher — one role per
// login, so those emails can't buy the hub), and returns a one-time
// password-setup link, which is also emailed. The link is returned too so
// the admin can copy it if the email can't be delivered.
export async function provisionAiMember(
  supabase: SupabaseClient,
  email: string,
  fullName: string
): Promise<{ userId: string; setupUrl: string; emailSent: boolean }> {
  let userId: string;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (createErr) {
    const alreadyExists = createErr.status === 422 || /already|registered|exists/i.test(createErr.message);
    if (!alreadyExists) throw createErr;
    const existing = await findUserByEmail(supabase, email);
    if (!existing) throw new Error(`User ${email} exists but could not be located.`);
    userId = existing.id;
  } else {
    userId = created.user.id;
  }

  const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (!roleRow) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "ai_member" });
    if (error) throw error;
  } else if (roleRow.role !== "ai_member") {
    throw new AiMemberProvisionError(
      `${email} already has a ${roleRow.role} login. Ask them to join Le Kiosque with a different email.`
    );
  }

  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password` },
  });
  if (linkErr) throw linkErr;
  const setupUrl = `${SITE_URL}/auth/confirm?token_hash=${link.properties?.hashed_token}&type=recovery&next=/reset-password`;
  const emailSent = await sendAiHubWelcomeEmail(email, fullName, setupUrl);
  return { userId, setupUrl, emailSent };
}
