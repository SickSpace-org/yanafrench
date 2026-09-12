import { Resend } from "resend";

// Transactional email only (password-setup links). Same "missing config ->
// skip, don't throw" convention as lib/r2.ts / getSupabaseAdmin — a student
// account still gets created even if email sending isn't configured or
// fails; the admin can always resend from Admin -> Students.
//
// FROM_ADDRESS defaults to Resend's own sandbox sender, which only
// delivers to the Resend account's own verified email until a sending
// domain is verified (Authentication -> Domains) — see RESEND_FROM_ADDRESS.
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "The Français Hub <onboarding@resend.dev>";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.error("RESEND_API_KEY isn't configured — skipping email to", to);
    return false;
  }

  const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, text, html });
  if (error) {
    console.error("Failed to send email to", to, error);
    return false;
  }
  return true;
}

export async function sendPasswordSetupEmail(to: string, setupUrl: string): Promise<boolean> {
  return sendEmail(
    to,
    "Set up your Français Hub login",
    `Welcome to The Français Hub!\n\nSet up a password for your student account here:\n${setupUrl}\n\nThis link is one-time use and expires after a while — if it's stopped working, ask Yana to send you a new one.`,
    `<p>Welcome to The Français Hub!</p><p>Set up a password for your student account here:</p><p><a href="${setupUrl}">${setupUrl}</a></p><p>This link is one-time use and expires after a while — if it's stopped working, ask Yana to send you a new one.</p>`
  );
}

// Distinct copy from sendPasswordSetupEmail — this is /forgot-password's
// "I already have an account, I forgot my password" flow, not first-time
// setup. Same underlying link mechanism (see app/api/auth/forgot-password).
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  return sendEmail(
    to,
    "Reset your Français Hub password",
    `Someone requested a password reset for this Français Hub account.\n\nSet a new password here:\n${resetUrl}\n\nThis link is one-time use and expires after a while. If you didn't request this, you can ignore this email.`,
    `<p>Someone requested a password reset for this Français Hub account.</p><p>Set a new password here:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link is one-time use and expires after a while. If you didn't request this, you can ignore this email.</p>`
  );
}
