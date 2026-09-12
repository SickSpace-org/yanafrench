import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPasswordResetEmail } from "@/lib/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";

// Public — anyone can request a reset link for any email, but the response
// never reveals whether that email actually has an account (same
// anti-enumeration property the old resetPasswordForEmail() call had).
//
// Deliberately does NOT use supabase.auth.resetPasswordForEmail(): that
// triggers Supabase's own default email template, which links to
// /auth/v1/verify and redirects back with the session in a URL fragment
// (#access_token=...) rather than the ?token_hash= query param /auth/confirm
// expects — fragments never reach the server, so that link silently failed
// every time. generateLink() + our own email (same pattern as
// lib/studentAccount.ts) produces a link /auth/confirm actually understands.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (email) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: link, error } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password` },
        });

        // An error here almost always just means no account exists for
        // this email — expected and not logged as a failure. Anything
        // else (Resend/config issues) is still swallowed from the
        // response, but worth a server-side log.
        if (!error) {
          const tokenHash = link.properties?.hashed_token;
          const resetUrl = `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password`;
          const sent = await sendPasswordResetEmail(email, resetUrl);
          if (!sent) console.error("Failed to send password-reset email to", email);
        }
      } catch (err) {
        console.error("forgot-password: unexpected error for", email, err);
      }
    }
  }

  // Always the same response, regardless of whether the email exists,
  // has a Resend delivery restriction, or anything else went wrong.
  return Response.json({ ok: true });
}
