import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { sendPasswordSetupEmail } from "./email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";

async function findUserByEmail(supabase: SupabaseClient, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

export type ProvisionResult = { userId: string; emailSent: boolean };

// Finds or creates the Supabase Auth user for a paying student, makes sure
// they have the student role (never downgrading an existing admin who
// happens to share the email — see db/phase3-student-accounts.sql), and
// emails a one-time password-setup link. Also used standalone by Admin ->
// Students' "Resend setup link" for an already-linked student — generating
// a fresh recovery link and re-sending works the same way whether the
// account is brand new or not.
//
// Best-effort: swallows and logs its own errors so a broken provisioning
// step never fails the caller (payment/verify must not fail a verified
// payment just because, say, the email couldn't be sent).
export async function provisionStudentAccount(email: string): Promise<ProvisionResult | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let userId: string;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
    });

    if (createErr) {
      const alreadyExists = createErr.status === 422 || /already|registered|exists/i.test(createErr.message);
      if (!alreadyExists) throw createErr;
      const existing = await findUserByEmail(supabase, normalizedEmail);
      if (!existing) throw new Error(`User ${normalizedEmail} exists but could not be located.`);
      userId = existing.id;
    } else {
      userId = created.user.id;
    }

    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingRole) {
      const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: userId, role: "student" });
      if (roleErr) throw roleErr;
    }

    const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password` },
    });
    if (linkErr) throw linkErr;

    const tokenHash = link.properties?.hashed_token;
    const setupUrl = `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password`;
    const emailSent = await sendPasswordSetupEmail(normalizedEmail, setupUrl);

    return { userId, emailSent };
  } catch (error) {
    console.error("Failed to provision student account for", normalizedEmail, error);
    return null;
  }
}
