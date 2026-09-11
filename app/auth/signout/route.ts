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

  const supabase = await createServerSupabase();
  await supabase.auth.signOut();

  // 303 so the browser follows with GET.
  return NextResponse.redirect(new URL("/login?notice=signed_out", request.url), {
    status: 303,
  });
}
