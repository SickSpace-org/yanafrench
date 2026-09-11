// Server-side Supabase client bound to the request's cookies, for use in
// Server Components, Route Handlers and Server Actions. Created per-request
// (cheap) — never cache it, cookies differ every request.
//
// Reads the publishable/anon key, not the service role: this client acts
// AS the signed-in user, so RLS applies. Privileged writes still go through
// lib/supabaseAdmin.ts.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component, which can't set cookies. Safe to
          // ignore — proxy.ts refreshes the session cookie on every request.
        }
      },
    },
  });
}
