// Server-only teacher operations. Service-role client only — teachers and
// batch_teachers have RLS on with no policies (see
// supabase/migrations/20261009120100_create_teachers.sql), so this file,
// not the database, is the access boundary: every teacher API route goes
// through requireTeacher(), which re-checks the teachers row on every
// request (never just the JWT role claim, which can be up to an hour stale).

import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthError, getViewer, type Viewer } from "./auth";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { readPortalState } from "./portalStateServer";
import { findUserByEmail } from "./studentAccount";
import type { Batch } from "./batchData";
import {
  TEACHER_COLUMNS,
  teacherFromRow,
  type RosterStudent,
  type Teacher,
  type TeacherBatch,
  type TeacherRow,
} from "./teacherData";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getTeacherByUserId(supabase: SupabaseClient, userId: string): Promise<Teacher | null> {
  const { data, error } = await supabase.from("teachers").select(TEACHER_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? teacherFromRow(data as TeacherRow) : null;
}

export async function getTeacherById(supabase: SupabaseClient, id: string): Promise<Teacher | null> {
  const { data, error } = await supabase.from("teachers").select(TEACHER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? teacherFromRow(data as TeacherRow) : null;
}

// The batch ids assigned to this teacher in batch_teachers that still
// exist in R2 — a row left behind by a deleted batch never counts.
export async function teacherBatchIds(supabase: SupabaseClient, teacherId: string, batches: Batch[]): Promise<string[]> {
  const { data, error } = await supabase.from("batch_teachers").select("batch_id").eq("teacher_id", teacherId);
  if (error) throw error;
  const known = new Set(batches.map((b) => b.id));
  return (data ?? []).map((r) => r.batch_id as string).filter((id) => known.has(id));
}

export function toTeacherBatch(b: Batch): TeacherBatch {
  return {
    id: b.id,
    name: b.name,
    course: b.course,
    level: b.level ?? null,
    slots: b.slots,
    startDate: b.start_date ?? null,
    endDate: b.end_date ?? null,
  };
}

export type TeacherContext = { viewer: Viewer; teacher: Teacher; supabase: SupabaseClient };

// The guard for every teacher API route: signed in (401), role 'teacher'
// with a teachers row that is ACTIVE (403), and — when batchId is given —
// that batch exists in R2 and is assigned to this teacher (403). Throws
// AuthError; routes map it with authErrorResponse() like the other guards.
export async function requireTeacher(opts: { batchId?: string } = {}): Promise<TeacherContext> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthError(401);
  if (viewer.role !== "teacher") throw new AuthError(403);

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new AuthError(403);

  const teacher = await getTeacherByUserId(supabase, viewer.userId);
  if (!teacher || teacher.status !== "active") throw new AuthError(403);

  if (opts.batchId !== undefined) {
    const { batches } = await readPortalState();
    const owned = await teacherBatchIds(supabase, teacher.id, batches);
    if (!owned.includes(opts.batchId)) throw new AuthError(403);
  }

  return { viewer, teacher, supabase };
}

// Non-throwing lookup for the /teacher layout, which needs to tell "paused"
// apart from "not a teacher" to render the right screen.
export type TeacherSession =
  | { kind: "none" }
  | { kind: "deactivated"; teacher: Teacher }
  | { kind: "active"; teacher: Teacher };

export async function getTeacherSession(): Promise<TeacherSession> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "teacher") return { kind: "none" };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { kind: "none" };
  const teacher = await getTeacherByUserId(supabase, viewer.userId).catch(() => null);
  if (!teacher) return { kind: "none" };
  return teacher.status === "active" ? { kind: "active", teacher } : { kind: "deactivated", teacher };
}

export class TeacherInviteError extends Error {
  constructor(message: string, public status: 400 | 409 | 500 = 409) {
    super(message);
  }
}

// One login, one role: refuses an email that is already a student, a
// teacher, or any existing login (admin, student, or one with no role).
export async function assertEmailFreeForTeacher(supabase: SupabaseClient, email: string) {
  const [{ data: teacher }, { data: student }] = await Promise.all([
    supabase.from("teachers").select("id").eq("email", email).maybeSingle(),
    supabase.from("students").select("id").eq("email", email).maybeSingle(),
  ]);
  if (teacher) throw new TeacherInviteError("A teacher with that email already exists.");
  if (student) throw new TeacherInviteError("That email belongs to a student — a teacher needs a different email.");
  if (await findUserByEmail(supabase, email)) {
    throw new TeacherInviteError("That email already has a login on this site — a teacher needs a different email.");
  }
}

// Makes sure the teacher has a linked auth login with the 'teacher' role,
// then returns a fresh one-time setup link (same recovery-link mechanism
// as student accounts, see lib/studentAccount.ts). Idempotent, so
// "Resend invite" simply calls it again. Never touches a login that
// belongs to anyone else: an existing auth user is only adopted when it
// is this teacher's own half-finished invite (role 'teacher' or no role,
// and no students row).
export async function linkTeacherAndCreateSetupLink(supabase: SupabaseClient, teacher: Teacher): Promise<string> {
  let userId = teacher.userId;

  if (!userId) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: teacher.email,
      email_confirm: true,
    });
    if (createErr) {
      const alreadyExists = createErr.status === 422 || /already|registered|exists/i.test(createErr.message);
      if (!alreadyExists) throw createErr;
      const existing = await findUserByEmail(supabase, teacher.email);
      if (!existing) throw new Error(`Login for ${teacher.email} exists but could not be located.`);
      userId = existing.id;
    } else {
      userId = created.user.id;
    }
  }

  const [{ data: role }, { data: student }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase.from("students").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if ((role && role.role !== "teacher") || student) {
    throw new TeacherInviteError("That email's login belongs to an admin or student — it can't be used for a teacher.");
  }
  if (!role) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "teacher" });
    if (error) throw error;
  }

  if (teacher.userId !== userId) {
    const { error } = await supabase
      .from("teachers")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq("id", teacher.id);
    if (error) throw error;
  }

  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: teacher.email,
    options: { redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password` },
  });
  if (linkErr) throw linkErr;
  const tokenHash = link.properties?.hashed_token;
  return `${SITE_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password`;
}

// Students set their own avatar_url (app/api/student/me PATCH accepts any
// string), so a roster only passes on avatars stored in this site's own R2
// avatars/ folder. Anything else — e.g. an image on a server the student
// controls, which would learn when a teacher opened the roster — becomes
// null and the portal shows initials instead.
function safeAvatarUrl(url: string | null): string | null {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!url || !base) return null;
  return url.startsWith(`${base}/avatars/`) && !url.includes("..") ? url : null;
}

// The roster of one batch: every student with an ACTIVE batch_enrollments
// row for it. Callers must have checked ownership first (requireTeacher
// with this batchId). Explicit columns only — never select("*") on students.
export async function teacherRoster(supabase: SupabaseClient, batchId: string): Promise<RosterStudent[]> {
  const { data: enrollments, error } = await supabase
    .from("batch_enrollments")
    .select("student_id")
    .eq("batch_id", batchId)
    .eq("status", "active");
  if (error) throw error;
  const ids = [...new Set((enrollments ?? []).map((e) => e.student_id as string))];
  if (ids.length === 0) return [];

  const { data: students, error: studentErr } = await supabase.from("students").select("id, name, avatar_url").in("id", ids);
  if (studentErr) throw studentErr;
  return (students ?? [])
    .map((s) => ({ id: s.id as string, name: s.name as string, avatarUrl: safeAvatarUrl(s.avatar_url as string | null) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// For routes that act on one stored row (a recording, a material…): signed
// in as an ACTIVE teacher, the row exists, and the row's own batch_id —
// never one taken from the request — is one of the teacher's batches.
// Throws AuthError (401/403); returns null when the row doesn't exist.
export async function requireTeacherForRow<T extends { batch_id: string }>(
  table: string,
  id: string,
  columns: string
): Promise<{ ctx: TeacherContext; row: T } | null> {
  const base = await requireTeacher();
  const { data, error } = await base.supabase.from(table).select(columns).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as T;
  return { ctx: await requireTeacher({ batchId: row.batch_id }), row };
}
