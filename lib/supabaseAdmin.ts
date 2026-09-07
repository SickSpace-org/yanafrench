// Server-only Supabase client using the service-role key, which bypasses
// row-level security — every table it touches (leads/payments/students)
// has RLS enabled with no policies, so it's deliberately unreachable via
// the public anon key; all access goes through this app's own API routes.
// Lazily constructed (not at module top-level) so a build with no
// Supabase env vars configured yet doesn't crash — same reasoning as
// lib/r2.ts's getR2Client.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
