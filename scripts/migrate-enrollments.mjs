// ─────────────────────────────────────────────────────────────────────────────
// One-off: split students (identity) into students + batch_enrollments /
// course_enrollments (enrollment), and de-duplicate students rows that share
// an email (the students_user_id_key bug — see app/api/payment/verify —
// silently dropped the student row for a second enrollment under an email
// that already had one, so today's `students` table has real duplicate-email
// rows, and at least one real paid payment with NO students row at all).
//
//   node --env-file=.env.local scripts/migrate-enrollments.mjs           (dry run, default)
//   node --env-file=.env.local scripts/migrate-enrollments.mjs --apply   (writes for real)
//
// Dry run does ZERO writes — it only reads students/payments/leads and
// prints exactly what it would do. Review the report before ever passing
// --apply.
//
// Requires supabase/migrations/20260915090000_create_enrollments.sql to have
// been applied first (needs batch_enrollments/course_enrollments to exist)
// before running with --apply — dry run works without it.
//
// Survivor selection per email group:
//   1. The row with a non-null user_id (the one people can actually log in
//      with) wins — losing that would break a real login.
//   2. If more than one row in a group has a DIFFERENT non-null user_id,
//      that's a genuinely ambiguous case (same email somehow tied to two
//      different auth accounts) — flagged, not auto-resolved.
//   3. Otherwise (no row has a user_id yet), the oldest enrolled_at wins.
//
// Every non-survivor row's course/batch/lead/payment becomes a
// batch_enrollments row under the survivor's id — no enrollment data is
// discarded, only the redundant identity rows are removed.
//
// Reconciliation pass: for every `payments` row with status="paid" that has
// no matching students.payment_id anywhere in the current data (the
// swallowed-insert bug), that enrollment is added to the matching email's
// group (or becomes a new identity if the email has no students row at all).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

// Payments confirmed by the operator as deliberately-cleaned-up test data —
// NOT a bug, NOT to be reconstructed as a student/enrollment even though
// they're still "paid" in the payments ledger. Add a payment id here (with
// a one-line reason) any time a dry run surfaces something that turns out
// to be intentional rather than the swallowed-insert bug.
const EXCLUDED_PAYMENT_IDS = new Set([
  "order_TZ9aTojJrucjET", // Abhi / abhinav@gmail.com — deliberately deleted by the operator, Sep 7 test cleanup
]);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\nRun with: node --env-file=.env.local scripts/migrate-enrollments.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY RUN (read-only)"}\n`);

  const [{ data: students, error: studentsErr }, { data: payments, error: paymentsErr }] = await Promise.all([
    supabase.from("students").select("*").order("enrolled_at", { ascending: true }),
    supabase.from("payments").select("*").eq("status", "paid"),
  ]);
  if (studentsErr) throw studentsErr;
  if (paymentsErr) throw paymentsErr;

  // ---- Group existing students rows by lowercased email ----
  const groups = new Map(); // email -> { rows: [...students rows] }
  for (const row of students) {
    const email = row.email.trim().toLowerCase();
    if (!groups.has(email)) groups.set(email, { rows: [] });
    groups.get(email).rows.push(row);
  }

  const ambiguous = [];
  const plan = []; // { email, survivor, nonSurvivors: [...], enrollmentsFromStudents: [...] }

  for (const [email, group] of groups) {
    const withUser = group.rows.filter((r) => r.user_id);
    const distinctUserIds = new Set(withUser.map((r) => r.user_id));

    let survivor;
    if (distinctUserIds.size > 1) {
      ambiguous.push({ email, rows: group.rows });
      continue;
    } else if (withUser.length >= 1) {
      survivor = withUser[0];
    } else {
      survivor = [...group.rows].sort((a, b) => new Date(a.enrolled_at) - new Date(b.enrolled_at))[0];
    }

    const nonSurvivors = group.rows.filter((r) => r.id !== survivor.id);
    const enrollmentsFromStudents = group.rows.map((r) => ({
      source: "students-row",
      studentRowId: r.id,
      lead_id: r.lead_id,
      payment_id: r.payment_id,
      course: r.course,
      batch_id: r.batch_id,
      batch_name: r.batch_name,
      enrolled_at: r.enrolled_at,
    }));

    plan.push({ email, survivor, nonSurvivors, enrollmentsFromStudents, isNewIdentity: false });
  }

  // ---- Reconciliation: paid payments with no matching students.payment_id anywhere ----
  const coveredPaymentIds = new Set(students.map((r) => r.payment_id));
  const orphanPayments = payments.filter((p) => !coveredPaymentIds.has(p.id) && !EXCLUDED_PAYMENT_IDS.has(p.id));
  const excludedFound = payments.filter((p) => !coveredPaymentIds.has(p.id) && EXCLUDED_PAYMENT_IDS.has(p.id));

  const reconciled = [];
  for (const p of orphanPayments) {
    const email = p.email.trim().toLowerCase();
    let target = plan.find((g) => g.email === email);
    if (!target) {
      // No students row at all for this email — becomes a brand-new identity,
      // built from the payment's own contact details.
      target = {
        email,
        survivor: null, // no existing students row — will be created fresh
        nonSurvivors: [],
        enrollmentsFromStudents: [],
        newIdentitySeed: { name: p.name, email: p.email, phone: p.phone },
        isNewIdentity: true,
      };
      plan.push(target);
    }
    const entry = {
      source: "reconciled-payment",
      paymentId: p.id,
      lead_id: p.lead_id,
      payment_id: p.id,
      course: p.course,
      batch_id: p.batch_id,
      batch_name: p.batch_name,
      enrolled_at: p.paid_at || p.created_at,
    };
    target.enrollmentsFromStudents.push(entry);
    reconciled.push({ email, paymentId: p.id, name: p.name, course: p.course, batchName: p.batch_name });
  }

  // ---- Report ----
  console.log(`Found ${students.length} existing students rows across ${groups.size} distinct emails.`);
  console.log(`Found ${payments.length} paid payments; ${orphanPayments.length} have no matching students row (reconciled below).`);
  if (excludedFound.length) {
    console.log(`Excluded from reconciliation (operator-confirmed deliberate deletions, not the bug): ${excludedFound.map((p) => p.id).join(", ")}`);
  }
  console.log("");

  console.log("─────────────────────────────────────────────");
  console.log("PLAN — one row per resulting identity");
  console.log("─────────────────────────────────────────────\n");

  for (const g of plan) {
    const label = g.isNewIdentity ? `${g.email}  [NEW IDENTITY — no prior students row]` : g.email;
    console.log(`• ${label}`);
    if (g.survivor) {
      console.log(`  Survivor students row: ${g.survivor.id}  (name="${g.survivor.name}", user_id=${g.survivor.user_id || "null"}, enrolled_at=${g.survivor.enrolled_at})`);
    } else {
      console.log(`  Will create a NEW students row (name="${g.newIdentitySeed.name}", phone="${g.newIdentitySeed.phone}") — no auth account provisioned by this script; provisionStudentAccount runs the next time this email pays, or can be triggered manually via "Resend setup link" in Admin → Students.`);
    }
    if (g.nonSurvivors.length) {
      console.log(`  Non-survivor students rows to remove after their enrollment is copied forward: ${g.nonSurvivors.map((r) => r.id).join(", ")}`);
    }
    console.log(`  Resulting batch_enrollments (${g.enrollmentsFromStudents.length}):`);
    for (const e of g.enrollmentsFromStudents) {
      const tag = e.source === "reconciled-payment" ? " ← RECONCILED (previously missing entirely)" : "";
      console.log(`    - ${e.course} · ${e.batch_name}  (payment_id=${e.payment_id}, enrolled_at=${e.enrolled_at})${tag}`);
    }
    console.log("");
  }

  if (reconciled.length) {
    console.log("─────────────────────────────────────────────");
    console.log("RECONCILED PAYMENTS (previously had no students/enrollment row at all)");
    console.log("─────────────────────────────────────────────");
    for (const r of reconciled) {
      console.log(`  ${r.email} — ${r.name} — ${r.course} · ${r.batchName} — payment ${r.paymentId}`);
    }
    console.log("");
  }

  if (ambiguous.length) {
    console.log("─────────────────────────────────────────────");
    console.log("⚠ AMBIGUOUS — needs a human decision, NOT auto-resolved");
    console.log("─────────────────────────────────────────────");
    for (const a of ambiguous) {
      console.log(`  ${a.email}: rows ${a.rows.map((r) => `${r.id} (user_id=${r.user_id})`).join(", ")}`);
    }
    console.log("");
  }

  const totalEnrollments = plan.reduce((n, g) => n + g.enrollmentsFromStudents.length, 0);
  const totalRemoved = plan.reduce((n, g) => n + g.nonSurvivors.length, 0);
  console.log("─────────────────────────────────────────────");
  console.log("SUMMARY");
  console.log("─────────────────────────────────────────────");
  console.log(`  Resulting identities (students rows after migration): ${plan.length}`);
  console.log(`  Total batch_enrollments rows to be created: ${totalEnrollments}`);
  console.log(`  Existing students rows to be removed (data preserved as enrollments): ${totalRemoved}`);
  console.log(`  Ambiguous email groups needing a manual call: ${ambiguous.length}`);
  console.log(`  Sanity check: ${students.length} original rows − ${totalRemoved} removed + ${plan.filter(g=>g.isNewIdentity).length} new = ${plan.length} final identities. ${students.length - totalRemoved + plan.filter(g=>g.isNewIdentity).length === plan.length ? "OK ✓" : "MISMATCH ✗ — DO NOT APPLY"}`);

  if (!APPLY) {
    console.log("\nDry run only — nothing was written. Re-run with --apply once this looks right.");
    return;
  }

  if (ambiguous.length) {
    console.error("\nRefusing to apply: ambiguous email groups must be resolved manually first.");
    process.exit(1);
  }

  console.log("\nApplying...");
  for (const g of plan) {
    let survivorId = g.survivor?.id;

    if (g.isNewIdentity) {
      survivorId = newId("student");
      const { error } = await supabase.from("students").insert({
        id: survivorId,
        name: g.newIdentitySeed.name,
        email: g.newIdentitySeed.email,
        phone: g.newIdentitySeed.phone,
        enrolled_at: g.enrollmentsFromStudents[0]?.enrolled_at || new Date().toISOString(),
        user_id: null,
        avatar_url: null,
      });
      if (error) throw new Error(`Failed to create new identity for ${g.email}: ${error.message}`);
    }

    for (const e of g.enrollmentsFromStudents) {
      const { error } = await supabase.from("batch_enrollments").insert({
        id: newId("enroll"),
        student_id: survivorId,
        lead_id: e.lead_id,
        payment_id: e.payment_id,
        course: e.course,
        batch_id: e.batch_id,
        batch_name: e.batch_name,
        status: "active",
        enrolled_at: e.enrolled_at,
      });
      if (error) throw new Error(`Failed to insert enrollment for ${g.email} / payment ${e.payment_id}: ${error.message}`);
    }

    for (const r of g.nonSurvivors) {
      const { error } = await supabase.from("students").delete().eq("id", r.id);
      if (error) throw new Error(`Failed to remove duplicate students row ${r.id}: ${error.message}`);
    }
  }

  console.log("Done. Re-check Supabase directly to confirm.");
}

main().catch((err) => {
  console.error("\nFailed:", err.message || err);
  process.exit(1);
});
