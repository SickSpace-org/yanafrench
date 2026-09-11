// Session refresh + role resolution for proxy.ts (Next.js 16's renamed
// middleware). Runs on every matched request: revalidates the auth cookie
// with Supabase and figures out the caller's role.
//
// Role source, in order:
//   1. `user_role` claim in the JWT — populated once the Custom Access
//      Token hook is enabled in the dashboard (see db/auth-setup.sql).
//   2. Fallback: a direct read of public.user_roles (one indexed PK lookup,
//      allowed by the "read own role" RLS policy).
// The fallback is the working path until the hook is switched on; keeping
// both means enabling the hook later is a pure optimisation, no code change.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type ViewerRole = "admin" | "student" | null;

export type SessionResult = {
  response: NextResponse;
  userId: string | null;
  email: string | null;
  role: ViewerRole;
};

function roleFromClaim(value: unknown): ViewerRole {
  return value === "admin" || value === "student" ? value : null;
}

export async function resolveSession(request: NextRequest): Promise<SessionResult> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getClaims() validates the JWT (locally against cached JWKS when the
  // project uses asymmetric keys, otherwise via the auth server) and also
  // refreshes an expired session. The recommended call for a server-side
  // authorization gate — never getSession().
  const { data, error } = await supabase.auth.getClaims();
  const claims = (error ? null : data?.claims) as Record<string, unknown> | null;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) {
    return { response, userId: null, email: null, role: null };
  }

  let role = roleFromClaim(claims?.user_role);
  if (!role) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    role = roleFromClaim(roleRow?.role);
  }

  return {
    response,
    userId,
    email: typeof claims?.email === "string" ? claims.email : null,
    role,
  };
}

// NextResponse.redirect() starts a fresh response, dropping the refreshed
// auth cookies from `base`. Copy them across so the session stays in sync
// even on a redirect.
export function redirectPreservingSession(url: URL, base: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  base.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
