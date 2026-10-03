import { Resend } from "resend";
import type { EmiReminderKind } from "./emiData";

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

// EMI reminders, sent by the daily cron (app/api/cron/emi-reminders) —
// see lib/emiData.ts's reminderForToday for which kind goes out when.
export async function sendEmiReminderEmail(
  to: string,
  input: {
    name: string;
    kind: EmiReminderKind;
    productTitle: string;
    installmentNo: number;
    installmentCount: number;
    amount: string; // already formatted, e.g. "₹19,833"
    dueDate: string; // already formatted, e.g. "3 Oct 2026"
    lockDate: string; // already formatted
    payUrl: string;
  }
): Promise<boolean> {
  const first = input.name.split(" ")[0] || "there";
  const what = `EMI ${input.installmentNo} of ${input.installmentCount} for ${input.productTitle} (${input.amount})`;

  let subject: string;
  let lines: string[];
  if (input.kind === "pre5") {
    subject = `Your EMI of ${input.amount} is due on ${input.dueDate}`;
    lines = [`Hi ${first},`, `A friendly reminder: your ${what} is due on ${input.dueDate} — 5 days from now.`, `You can pay it any time from your Student Hub.`];
  } else if (input.kind === "due") {
    subject = `Your EMI of ${input.amount} is due today`;
    lines = [`Hi ${first},`, `Your ${what} is due today, ${input.dueDate}.`, `Please pay it from your Student Hub. If it isn't paid by ${input.lockDate}, your Student Hub will be locked until it is.`];
  } else if (input.kind === "locked") {
    subject = "Your Student Hub is locked — EMI overdue";
    lines = [`Hi ${first},`, `Your ${what} was due on ${input.dueDate} and is still unpaid, so your Student Hub has been locked.`, `Pay the EMI to unlock it instantly — your lessons, progress and everything else are waiting for you.`];
  } else {
    const daysLeft = Number(input.kind.slice(5));
    const remaining = 5 - daysLeft;
    subject = remaining === 0 ? "Last day to pay your EMI before your Student Hub is locked" : `EMI overdue — pay now or your Student Hub will be locked`;
    lines = [
      `Hi ${first},`,
      `Your ${what} was due on ${input.dueDate} and hasn't been paid yet.`,
      remaining === 0
        ? `Today is the last day to pay. From tomorrow (${input.lockDate}) your Student Hub will be locked until the EMI is paid.`
        : `Please pay your EMI now or your Student Hub will be locked on ${input.lockDate} (${remaining + 1} days from now).`,
    ];
  }

  const text = `${lines.join("\n\n")}\n\nPay your EMI: ${input.payUrl}\n\n— The Français Hub`;
  const html = `${lines.map((l) => `<p>${l}</p>`).join("")}<p><a href="${input.payUrl}" style="display:inline-block;padding:10px 18px;background:#1F3A5F;color:#fff;border-radius:999px;text-decoration:none;font-weight:700">Pay your EMI</a></p><p>— The Français Hub</p>`;
  return sendEmail(to, subject, text, html);
}

// Sent the moment someone submits an enroll form on the website (batch or
// course) — confirms what they asked for and points them at Yana on
// WhatsApp, since payment is arranged with her directly.
export async function sendEnrollmentReceivedEmail(
  to: string,
  input: {
    name: string;
    courseTitle: string;
    details: string[]; // already formatted lines, e.g. "Schedule: Mon/Wed · 7:00 PM"
    whatsappUrl: string;
    whatsappNumber: string; // display form, e.g. "+91 98704 16446"
  }
): Promise<boolean> {
  const first = input.name.split(" ")[0] || "there";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const intro = `Thank you for enrolling in ${input.courseTitle} at The Français Hub! We've received your details.`;
  const next = "Yana will get in touch with you shortly to confirm your seat and share the payment details. Once your payment is confirmed, you'll get your Student Hub login by email.";
  const ask = `Questions, or want to get started sooner? Message Yana on WhatsApp: ${input.whatsappNumber}`;

  const text = [`Hi ${first},`, intro, input.details.join("\n"), next, `${ask}\n${input.whatsappUrl}`, "À bientôt !\n— The Français Hub"].join("\n\n");
  const html =
    `<p>Hi ${esc(first)},</p><p>${esc(intro)}</p>` +
    `<table style="border-collapse:collapse;margin:8px 0 16px">${input.details
      .map((line) => {
        const [label, ...rest] = line.split(": ");
        return rest.length
          ? `<tr><td style="padding:4px 14px 4px 0;color:#666">${esc(label)}</td><td style="padding:4px 0;font-weight:700">${esc(rest.join(": "))}</td></tr>`
          : `<tr><td colspan="2" style="padding:4px 0">${esc(line)}</td></tr>`;
      })
      .join("")}</table>` +
    `<p>${esc(next)}</p>` +
    `<p><a href="${input.whatsappUrl}" style="display:inline-block;padding:10px 18px;background:#25D366;color:#fff;border-radius:999px;text-decoration:none;font-weight:700">Message Yana on WhatsApp</a></p>` +
    `<p style="color:#666">WhatsApp: ${esc(input.whatsappNumber)}</p><p>À bientôt !<br>— The Français Hub</p>`;
  return sendEmail(to, `We've received your enrollment — ${input.courseTitle}`, text, html);
}
