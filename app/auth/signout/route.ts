import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST-only so a prefetch or an <img> can't log anyone out. The "Log out"
// controls in DashboardShell / AdminShell / SettingsPage submit a form here.
export async function POST(request: Request) {
  // Reject cross-site form submissions (sign-out CSRF is low severity, but
  // cheap to close). Same-origin form posts send Sec-Fetch-Site: same-origin;
  // older browsers that omit it fall back to an Origin host check.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (!site && origin && new URL(origin).host !== new URL(request.url).host) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Student Hub's own logout forms (DashboardShell, SettingsPage) pass
  // ?redirect=/ so a deliberate logout lands on the public homepage instead
  // of /login — Admin's form omits it and keeps the old /login behavior.
  // Whitelisted to the literal "/" rather than passed through, since this
  // value ultimately drives a redirect target.
  const requestUrl = new URL(request.url);
  const toHome = requestUrl.searchParams.get("redirect") === "/";

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    // Don't claim success — send the student back to where they were
    // (same-origin Referer only) with a flag the page reads to show an
    // error instead of silently redirecting as if sign-out worked.
    const referer = request.headers.get("referer");
    let back = new URL(toHome ? "/" : "/login", request.url);
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host === requestUrl.host) back = refererUrl;
      } catch {}
    }
    back.searchParams.set("signout_error", "1");
    return NextResponse.redirect(back, { status: 303 });
  }

  // 303 so the browser follows with GET.
  const destination = toHome
    ? new URL("/?logged_out=1", request.url)
    : new URL("/login?notice=signed_out", request.url);
  return NextResponse.redirect(destination, { status: 303 });
}
