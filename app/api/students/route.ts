import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { studentFromRow, type StudentRow } from "@/lib/studentData";
import { batchEnrollmentFromRow, type BatchEnrollmentRow } from "@/lib/batchEnrollmentData";
import { courseEnrollmentFromRow, type CourseEnrollmentRow } from "@/lib/courseEnrollmentData";
import { emiInstallmentFromRow, type EmiInstallmentRow } from "@/lib/emiData";
import { addStudentToBatchAsAdmin, findStudentByEmail } from "@/lib/enrollment";
import { provisionStudentAccount } from "@/lib/studentAccount";
import { readPortalState } from "@/lib/portalStateServer";

// GET: the roster of confirmed, paying students for Admin → Students,
// newest first, each with every batch/course enrollment they hold — one
// person can have several (see lib/enrollment.ts). Rows are written by
// lib/enrollment.ts's resolveStudentIdentity on a successfully verified
// payment, or by the admin-only POST below — never publicly.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const [{ data: students, error }, { data: batchRows }, { data: courseRows }, { data: emiRows }, { data: batchPays }, { data: coursePays }] = await Promise.all([
    supabase.from("students").select("*").order("enrolled_at", { ascending: false }),
    supabase.from("batch_enrollments").select("*"),
    supabase.from("course_enrollments").select("*"),
    supabase.from("emi_installments").select("*").order("due_date", { ascending: true }),
    supabase.from("payments").select("id, amount, paid_at, created_at").eq("status", "paid"),
    supabase.from("course_payments").select("id, amount, paid_at, created_at").eq("status", "paid"),
  ]);
  if (error) {
    console.error("Failed to list students", error);
    return new Response("Failed to load students.", { status: 500 });
  }

  const batchesByStudent = new Map<string, BatchEnrollmentRow[]>();
  for (const row of (batchRows as BatchEnrollmentRow[]) ?? []) {
    const list = batchesByStudent.get(row.student_id) ?? [];
    list.push(row);
    batchesByStudent.set(row.student_id, list);
  }
  const coursesByStudent = new Map<string, CourseEnrollmentRow[]>();
  for (const row of (courseRows as CourseEnrollmentRow[]) ?? []) {
    const list = coursesByStudent.get(row.student_id) ?? [];
    list.push(row);
    coursesByStudent.set(row.student_id, list);
  }

  const emiByStudent = new Map<string, EmiInstallmentRow[]>();
  for (const row of (emiRows as EmiInstallmentRow[]) ?? []) {
    const list = emiByStudent.get(row.student_id) ?? [];
    list.push(row);
    emiByStudent.set(row.student_id, list);
  }

  // Total paid per student: each enrollment's first payment (confirmed by
  // the admin, or online for older ones) + every EMI paid since.
  const paidById = new Map<string, number>();
  for (const p of [...(batchPays ?? []), ...(coursePays ?? [])]) paidById.set(p.id as string, p.amount as number);
  function totalPaidPaise(studentId: string) {
    const firsts = [...(batchesByStudent.get(studentId) ?? []), ...(coursesByStudent.get(studentId) ?? [])].reduce(
      (sum, e) => sum + (paidById.get(e.payment_id) ?? 0),
      0
    );
    const emis = (emiByStudent.get(studentId) ?? []).filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
    return firsts + emis;
  }

  // Each student's first payments (one per enrollment) — Admin → Payments edits these.
  function firstPayments(studentId: string) {
    const rows = [...(batchesByStudent.get(studentId) ?? []), ...(coursesByStudent.get(studentId) ?? [])];
    const seen = new Set<string>();
    const out: { id: string; amount: number; label: string }[] = [];
    for (const e of rows) {
      if (seen.has(e.payment_id) || !paidById.has(e.payment_id)) continue;
      seen.add(e.payment_id);
      const label = "product_title" in e ? e.product_title : `${e.course} · ${e.batch_name}`;
      out.push({ id: e.payment_id, amount: paidById.get(e.payment_id) as number, label });
    }
    return out;
  }

  const result = (students as StudentRow[]).map((row) => ({
    ...studentFromRow(
      row,
      (batchesByStudent.get(row.id) ?? []).map(batchEnrollmentFromRow),
      (coursesByStudent.get(row.id) ?? []).map(courseEnrollmentFromRow)
    ),
    emiInstallments: (emiByStudent.get(row.id) ?? []).map(emiInstallmentFromRow),
    totalPaidPaise: totalPaidPaise(row.id),
    firstPayments: firstPayments(row.id),
  }));

  return Response.json(result);
}

// POST: Admin → Students' "Add student" form — the admin creates a student
// by hand (e.g. someone who paid in cash or by bank transfer), optionally
// placing them straight into a batch and emailing the account setup link.
// Same students row a verified payment would create; the batch placement is
// the same payment-free override as app/api/batch-enrollments.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  const sendSetupLink = body?.sendSetupLink !== false;
  if (!name) return new Response("Name is required.", { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return new Response("Enter a valid email address.", { status: 400 });

  const batch = batchId ? (await readPortalState()).batches.find((b) => b.id === batchId) : undefined;
  if (batchId && !batch) return new Response("That batch doesn't exist.", { status: 404 });

  if (await findStudentByEmail(supabase, email)) {
    return new Response("A student with this email already exists.", { status: 409 });
  }

  const id = `student-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const { error } = await supabase.from("students").insert({
    id,
    name,
    email,
    phone,
    enrolled_at: new Date().toISOString(),
    user_id: null,
    avatar_url: null,
  });
  if (error?.code === "23505") return new Response("A student with this email already exists.", { status: 409 });
  if (error) {
    console.error("Failed to create student", email, error);
    return new Response("Failed to add student.", { status: 500 });
  }

  // From here the student exists, so anything that goes wrong is reported
  // back as a partial result rather than an error — the admin can retry the
  // batch or the setup link from the roster.
  let batchAdded = false;
  if (batch) {
    const batchErr = await addStudentToBatchAsAdmin(supabase, id, batch);
    if (batchErr) console.error("Failed to add new student", id, "to batch", batch.id, batchErr);
    else batchAdded = true;
  }

  let emailSent = false;
  if (sendSetupLink) {
    const provisioned = await provisionStudentAccount(email);
    if (provisioned) {
      emailSent = provisioned.emailSent;
      const { error: linkErr } = await supabase.from("students").update({ user_id: provisioned.userId }).eq("id", id);
      if (linkErr) console.error("Failed to link user_id for student", id, linkErr);
    }
  }

  return Response.json({ ok: true, id, batchAdded, emailSent });
}
