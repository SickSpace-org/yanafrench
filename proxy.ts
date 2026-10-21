// Next.js 16 Proxy (formerly middleware.ts). Runs on every request except
// static assets and /api/*. Two jobs:
//   1. Refresh the Supabase auth cookie for gated routes (resolveSession).
//   2. Gate /admin/**, /student-hub/** and /teacher/** by role. A signed-in
//      user who lands in another role's area is sent to their own home
//      (lib/roles.ts) rather than to /login, which would bounce them back.
//
// Session work is scoped to the routes that need it — /admin, /student-hub,
// /teacher and /login — so public marketing pages carry zero auth overhead.
//
// API routes are deliberately NOT gated here: proxy can't express the
// per-route public/student/admin split, and a matcher change could silently
// drop coverage of a Server Action. Each route handler gets its own guard
// (Phase 2). This file only protects page navigations.

import { NextResponse, type NextRequest } from "next/server";
import { resolveSession, redirectPreservingSession } from "@/lib/supabase/proxy";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isStudentHubLocked } from "@/lib/emi";
import { homeForRole } from "@/lib/roles";

// The single page a student can reach while their hub is locked for an
// overdue EMI (see lib/emiData.ts).
const PAY_EMI_PATH = "/student-hub/pay-emi";

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
  const needsTeacher = pathname === "/teacher" || pathname.startsWith("/teacher/");
  // Only the members' app is gated; the /kiosque sales page stays public.
  const needsAiMember = pathname === "/kiosque/app" || pathname.startsWith("/kiosque/app/");
  const isLogin = pathname === "/login";

  // /auth/* handlers and the other auth screens manage their own session;
  // everything public skips the Supabase round trip entirely.
  if (!needsAdmin && !needsStudent && !needsTeacher && !needsAiMember && !isLogin) {
    return NextResponse.next();
  }

  const { response, userId, role } = await resolveSession(request);

  if (isLogin) {
    if (userId && role) {
      return redirectPreservingSession(new URL(homeForRole(role), request.url), response);
    }
    return response;
  }

  if (needsAdmin) {
    if (!userId) return loginRedirect(request, response);
    if (role !== "admin") {
      return redirectPreservingSession(new URL(homeForRole(role), request.url), response);
    }
    // Signed-in-only content must never come back from bfcache after
    // logout (browser Back would otherwise flash the last-rendered page
    // before any script re-checks auth) or an intermediate cache.
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // Teacher portal — teachers only. Whether the teacher is still ACTIVE is
  // checked from the database by app/teacher/layout.tsx and by every
  // /api/teacher route (lib/teachers.ts), not from the JWT claim here.
  if (needsTeacher) {
    if (!userId) return loginRedirect(request, response);
    if (role !== "teacher") {
      if (!role) return loginRedirect(request, response);
      return redirectPreservingSession(new URL(homeForRole(role), request.url), response);
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // Le Kiosque members' app — ai_member logins, plus admins previewing it.
  // Whether the subscription is still paid up is checked by
  // app/kiosque/app/layout.tsx and every /api/ai-hub route (lib/aiHub.ts).
  if (needsAiMember) {
    if (!userId) return loginRedirect(request, response);
    if (role !== "ai_member" && role !== "admin") {
      if (!role) return loginRedirect(request, response);
      return redirectPreservingSession(new URL(homeForRole(role), request.url), response);
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // needsStudent — admins may view the student hub ("View as student"); a
  // teacher is sent to their own portal; a signed-in user with no role is
  // sent back to login.
  if (!userId) return loginRedirect(request, response);
  if (role === "teacher" || role === "ai_member") {
    return redirectPreservingSession(new URL(homeForRole(role), request.url), response);
  }
  if (role !== "student" && role !== "admin") {
    return loginRedirect(request, response);
  }
  // EMI lock: more than 5 days past an unpaid installment's due date, every
  // student-hub page redirects to the pay-now page until it's paid. Admins
  // previewing the hub are never locked.
  if (role === "student" && pathname !== PAY_EMI_PATH) {
    const admin = getSupabaseAdmin();
    if (admin && (await isStudentHubLocked(admin, userId))) {
      return redirectPreservingSession(new URL(PAY_EMI_PATH, request.url), response);
    }
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals, and static asset files.
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
