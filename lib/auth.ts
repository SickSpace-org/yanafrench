// Server-side "who is this request" helper for Server Components and (in
// Phase 2) route-handler guards. Same role-resolution logic as
// lib/supabase/proxy.ts: JWT claim first, user_roles table as fallback.

import { createServerSupabase } from "@/lib/supabase/server";

export type ViewerRole = "admin" | "student" | null;

export type Viewer = {
  userId: string;
  email: string | null;
  role: ViewerRole;
};

// Thrown by the guards; Phase 2 route handlers translate it to a Response.
export class AuthError extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? "Not authenticated" : "Forbidden");
  }
}

function roleFromClaim(value: unknown): ViewerRole {
  return value === "admin" || value === "student" ? value : null;
}

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.auth.getClaims();
  const claims = (error ? null : data?.claims) as Record<string, unknown> | null;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!userId) return null;

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
    userId,
    email: typeof claims?.email === "string" ? claims.email : null,
    role,
  };
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") {
    throw new AuthError(viewer ? 403 : 401);
  }
  return viewer;
}

// Student-scoped routes: a student may access their own data, and an admin
// may access the same routes (e.g. "View as student"). Same allowance as
// proxy.ts's /student-hub gate.
export async function requireStudent(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "student" && viewer.role !== "admin")) {
    throw new AuthError(viewer ? 403 : 401);
  }
  return viewer;
}

// Route handlers call a guard and pass any thrown AuthError here to get the
// Response it maps to; anything else rethrows.
export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return new Response(error.message, { status: error.status });
  }
  throw error;
}
