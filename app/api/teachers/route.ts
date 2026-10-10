import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { sendTeacherInviteEmail } from "@/lib/email";
import { readPortalState } from "@/lib/portalStateServer";
import {
  assertEmailFreeForTeacher,
  linkTeacherAndCreateSetupLink,
  normalizeEmail,
  TeacherInviteError,
} from "@/lib/teachers";
import { TEACHER_COLUMNS, teacherFromRow, type AdminTeacher, type TeacherRow } from "@/lib/teacherData";

// GET: Admin -> Teachers' list, oldest first, each with the batches assigned
// to them (batch_teachers rows whose batch still exists in R2).
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const [{ data: rows, error }, { data: assignments, error: assignErr }, { batches }] = await Promise.all([
    supabase.from("teachers").select(TEACHER_COLUMNS).order("created_at", { ascending: true }),
    supabase.from("batch_teachers").select("batch_id, teacher_id"),
    readPortalState(),
  ]);
  if (error || assignErr) {
    console.error("Failed to list teachers", error ?? assignErr);
    return new Response("Failed to load teachers.", { status: 500 });
  }

  const known = new Set(batches.map((b) => b.id));
  const byTeacher = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    if (!known.has(a.batch_id as string)) continue;
    const list = byTeacher.get(a.teacher_id as string) ?? [];
    list.push(a.batch_id as string);
    byTeacher.set(a.teacher_id as string, list);
  }

  const result: AdminTeacher[] = ((rows as TeacherRow[]) ?? []).map((row) => ({
    ...teacherFromRow(row),
    batchIds: byTeacher.get(row.id) ?? [],
  }));
  return Response.json(result);
}

// POST: add a teacher by name + email and invite them. Teachers never
// self-register; this is the only way a teacher login comes to exist. The
// teacher row is saved first, so if linking or the email fails the admin
// can simply "Resend invite" — nothing is lost. The email itself goes out
// in after(), so this returns as soon as the database work is done.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = await req.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  if (!fullName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response("Enter the teacher's name and a valid email.", { status: 400 });
  }

  try {
    await assertEmailFreeForTeacher(supabase, email);
  } catch (err) {
    if (err instanceof TeacherInviteError) return new Response(err.message, { status: err.status });
    console.error("Failed to check teacher email", email, err);
    return new Response("Failed to add teacher.", { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("teachers")
    .insert({
      id: `teacher-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      full_name: fullName,
      email,
      status: "active",
      created_at: now,
      updated_at: now,
    })
    .select(TEACHER_COLUMNS)
    .single();
  if (error?.code === "23505") return new Response("A teacher with that email already exists.", { status: 409 });
  if (error || !inserted) {
    console.error("Failed to insert teacher", email, error);
    return new Response("Failed to add teacher.", { status: 500 });
  }
  const teacher = teacherFromRow(inserted as TeacherRow);

  try {
    const setupUrl = await linkTeacherAndCreateSetupLink(supabase, teacher);
    after(() =>
      sendTeacherInviteEmail(teacher.email, teacher.fullName, setupUrl)
        .then((sent) => {
          if (!sent) console.error("Teacher invite email not delivered to", teacher.email);
        })
        .catch((err) => console.error("Teacher invite email failed for", teacher.email, err))
    );
    return Response.json({ ok: true, invited: true });
  } catch (err) {
    // The teacher row stays; Admin -> Teachers shows "Resend invite".
    console.error("Failed to invite teacher", teacher.email, err);
    const message = err instanceof TeacherInviteError ? err.message : "Teacher saved, but the invite failed — use Resend invite.";
    return Response.json({ ok: true, invited: false, message });
  }
}
