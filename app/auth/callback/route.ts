import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// PKCE code exchange — used by flows that return `?code=` (OAuth, and some
// email-link configurations). Email OTP links land on /auth/confirm instead.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/auth/home";

  const supabase = await createServerSupabase();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Same defensive rule as /auth/confirm: a failed exchange must not fall
  // through to whatever session this browser already had.
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
