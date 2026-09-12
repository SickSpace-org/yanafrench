import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Landing point for the links in Supabase auth emails — invite, password
// recovery, email-change confirmation, magic link. Verifies the one-time
// token, which establishes a session, then forwards to `next`
// (default: /reset-password, so an invited user can set a password).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/reset-password";

  const supabase = await createServerSupabase();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // A missing/invalid/expired token must never fall through to whatever
  // session this browser already happened to have — sign out first so a
  // bad link always lands on a clean, logged-out /login, never silently
  // reusing an unrelated still-active session (e.g. an admin's).
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?error=link_invalid", request.url));
}
