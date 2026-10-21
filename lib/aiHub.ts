// Server-only. Access control and helpers for Le Kiosque — the standalone
// paid product. Members have no password: they type the email they signed up
// with, and if Yana has marked their payment received (status 'active' with a
// future expires_at) they're let in. The member is remembered by a signed
// cookie (lib/aiHubSession.ts); the subscription itself is re-checked from
// the database on every request. Admins can also open it to preview.

import { AuthError, getViewer } from "./auth";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { checkRateLimit } from "./rateLimit";
import { readMemberCookie } from "./aiHubSession";
import {
  AI_HUB_MEMBER_COLUMNS,
  AI_HUB_PERIOD_DAYS,
  accessFor,
  daysUntil,
  type AiHubAccess,
  type AiHubMemberRow,
} from "./aiHubData";

// `userId` is the owner key for everything a member saves: their member id
// ("aim-…"), or "admin-<uuid>" for an admin previewing.
export type AiHubIdentity = { userId: string };

export type AiHubSession =
  | { kind: "active"; viewer: AiHubIdentity; isAdmin: boolean; daysLeft: number; name: string }
  | { kind: "blocked"; reason: Exclude<AiHubAccess, "active">; viewer: AiHubIdentity; name: string }
  | { kind: "none" };

const ADMIN_SESSION: Omit<Extract<AiHubSession, { kind: "active" }>, "viewer"> = { kind: "active", isAdmin: true, daysLeft: 0, name: "Admin" };

// The auth user id behind an admin email, or null if that email isn't an
// admin's. Looked up live from user_roles, so every current admin works and
// a newly added (or removed) one is picked up with no change here.
export async function findAdminUserIdByEmail(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  for (const { user_id } of roles ?? []) {
    const { data } = await supabase.auth.admin.getUserById(user_id as string);
    if (data.user?.email?.toLowerCase() === email) return user_id as string;
  }
  return null;
}

async function isAdminUser(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  return data?.role === "admin";
}

export async function getAiHubSession(): Promise<AiHubSession> {
  // An admin signed in to the admin panel can open Le Kiosque directly.
  const admin = await getViewer().catch(() => null);
  if (admin?.role === "admin") return { ...ADMIN_SESSION, viewer: { userId: `admin-${admin.userId}` } };

  const memberId = await readMemberCookie();
  if (!memberId) return { kind: "none" };

  // An admin who entered their email on /kiosque/enter. Re-checked every
  // time, so removing someone's admin role closes this door too.
  if (memberId.startsWith("admin-")) {
    return (await isAdminUser(memberId.slice("admin-".length))) ? { ...ADMIN_SESSION, viewer: { userId: memberId } } : { kind: "none" };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return { kind: "none" };
  const { data } = await supabase.from("ai_hub_members").select(AI_HUB_MEMBER_COLUMNS).eq("id", memberId).maybeSingle();
  const row = data as AiHubMemberRow | null;
  if (!row) return { kind: "none" };

  const viewer = { userId: row.id };
  const access = accessFor(row.status, row.expires_at);
  if (access !== "active") return { kind: "blocked", reason: access, viewer, name: row.full_name };
  return { kind: "active", viewer, isAdmin: false, daysLeft: daysUntil(row.expires_at), name: row.full_name };
}

// Guard for every /api/ai-hub/* member route. Throws AuthError (401 when not
// entered, 403 when the subscription isn't active).
export async function requireAiMember(): Promise<AiHubIdentity> {
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
