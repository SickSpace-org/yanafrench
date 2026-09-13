// Server-only. Fixed-window rate limiting for the AI routes, backed by
// Postgres (see supabase/migrations/20260913120000_create_rate_limits.sql)
// rather than a new Redis/Upstash dependency — this app already has
// Supabase fully wired, and a rate-limit check is a single atomic RPC call.
//
// Fails OPEN: if the check itself errors (e.g. a transient Supabase issue),
// the request is allowed through and the error is logged. Consistent with
// how this app treats other non-critical infrastructure failures (email,
// uploads) — a rate limiter outage shouldn't take down the AI features
// themselves, and everything else in the app would already be broken if
// Supabase were genuinely down.
import { getSupabaseAdmin } from "./supabaseAdmin";

export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return true;

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("Rate limit check failed — failing open for", key, error);
    return true;
  }

  return data === true;
}

const RATE_LIMIT_MESSAGE = "Too many requests — try again in a few minutes.";

export function rateLimitResponse(): Response {
  return new Response(RATE_LIMIT_MESSAGE, { status: 429 });
}

// Best-effort real client IP for the one public, unauthenticated route
// (/api/chat) — Vercel sets x-forwarded-for; falls back to a shared bucket
// on platforms/local dev that don't set it (acceptable — that fallback
// only ever applies outside real traffic).
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
