// ─────────────────────────────────────────────────────────────────────────────
// One-off: provision the single admin account.
//
//   node --env-file=.env.local scripts/create-admin.mjs [email]
//
// - email defaults to frenchyana9262@gmail.com; pass an argument to override.
// - Creates (or reuses) the Supabase Auth user with email pre-confirmed and
//   NO password, sets public.user_roles.role = 'admin', and prints a
//   password-setup link. The operator opens that link → /auth/confirm →
//   /reset-password to choose a password. The script never sets or sees one.
// - Requires db/auth-setup.sql to have been applied first (needs user_roles).
// - Uses the service-role key: run it locally, never ship it.
//
// This script has NOT been run. Review, then execute when ready.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const DEFAULT_EMAIL = "frenchyana9262@gmail.com";
const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with:  node --env-file=.env.local scripts/create-admin.mjs [email]"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(addr) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === addr);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  console.log(`Target admin email: ${email}`);
  console.log(`Site URL for links: ${SITE_URL}\n`);

  // 1. Create or reuse the auth user.
  let user = null;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createErr) {
    const alreadyExists =
      createErr.status === 422 || /already|registered|exists/i.test(createErr.message);
    if (!alreadyExists) throw createErr;
    console.log("User already exists — reusing it.");
    user = await findUserByEmail(email);
    if (!user) throw new Error(`User ${email} exists but could not be located.`);
  } else {
    user = created.user;
    console.log(`Created auth user ${user.id}`);
  }

  // 2. Grant the admin role (idempotent).
  const { error: roleErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id" });
  if (roleErr) {
    throw new Error(
      `Failed to set role — has db/auth-setup.sql been applied?\n${roleErr.message}`
    );
  }
  console.log("Role set: admin");

  // 3. Generate a password-setup link (no SMTP dependency).
  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password` },
  });
  if (linkErr) throw linkErr;

  const tokenHash = link.properties?.hashed_token;
  const setupUrl = `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password`;

  console.log("\n─────────────────────────────────────────────");
  console.log("Admin provisioned. Open this link to set the password:\n");
  console.log(`  ${setupUrl}\n`);
  console.log(
    "Use this link only — NOT link.properties.action_link. That one goes through\n" +
      "Supabase's /verify endpoint, which redirects with the session in a URL\n" +
      "fragment (#access_token=...). Fragments never reach the server, so /auth/confirm\n" +
      "(which reads token_hash from the query string) can't see it and bounces to\n" +
      "/login as if the link were invalid."
  );
  console.log("─────────────────────────────────────────────");
}

main().catch((err) => {
  console.error("\nFailed:", err.message || err);
  process.exit(1);
});
