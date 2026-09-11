// Next.js 16 Proxy (formerly middleware.ts). Runs on every request except
// static assets and /api/*. Two jobs:
//   1. Refresh the Supabase auth cookie for gated routes (resolveSession).
//   2. Gate /admin/** and /student-hub/** by role.
//
// Session work is scoped to the routes that need it — /admin, /student-hub
// and /login — so public marketing pages carry zero auth overhead.
//
// API routes are deliberately NOT gated here: proxy can't express the
// per-route public/student/admin split, and a matcher change could silently
// drop coverage of a Server Action. Each route handler gets its own guard
// (Phase 2). This file only protects page navigations.

import { NextResponse, type NextRequest } from "next/server";
import { resolveSession, redirectPreservingSession } from "@/lib/supabase/proxy";

const AUTH_PATHS = ["/login", "/forgot-password", "/reset-password", "/auth"];

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function loginRedirect(request: NextRequest, base: NextResponse) {
  const url = new URL("/login", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return redirectPreservingSession(url, base);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const needsStudent = pathname === "/student-hub" || pathname.startsWith("/student-hub/");
  const isLogin = pathname === "/login";

  // /auth/* handlers and the other auth screens manage their own session;
  // everything public skips the Supabase round trip entirely.
  if (!needsAdmin && !needsStudent && !isLogin) {
    return NextResponse.next();
  }

  const { response, userId, role } = await resolveSession(request);

  if (isLogin) {
    if (userId && role) {
      const home = role === "admin" ? "/admin" : "/student-hub";
      return redirectPreservingSession(new URL(home, request.url), response);
    }
    return response;
  }

  if (needsAdmin) {
    if (!userId) return loginRedirect(request, response);
    if (role !== "admin") {
      return redirectPreservingSession(new URL("/student-hub", request.url), response);
    }
    return response;
  }

  // needsStudent — admins may view the student hub ("View as student"); a
  // signed-in user with no role is sent back to login.
  if (!userId) return loginRedirect(request, response);
  if (role !== "student" && role !== "admin") {
    return loginRedirect(request, response);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals, and static asset files.
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
