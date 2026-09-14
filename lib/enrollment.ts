// Shared "identity" side of the payment-verify flow, used by both
// app/api/payment/verify (Programs/batches) and app/api/course-payment/
// verify (Courses tab) — see supabase/migrations/20260915090000_create_
// enrollments.sql for why this is split from the old embedded-course
// model. Both flows resolve the same way: one Supabase Auth user + one
// `students` row per email, however many things that email has paid for.

import type { SupabaseClient } from "@supabase/supabase-js";
import { provisionStudentAccount } from "./studentAccount";
import type { StudentRow } from "./studentData";
import { batchEnrollmentFromRow, type BatchEnrollment, type BatchEnrollmentRow } from "./batchEnrollmentData";
import { courseEnrollmentFromRow, type CourseEnrollment, type CourseEnrollmentRow } from "./courseEnrollmentData";

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Exact match on a normalized email, not ILIKE — ILIKE treats "_" (common
// in real addresses, e.g. john_doe@x.com) as a single-character wildcard,
// which could match a different person's email by coincidence. Every
// email this app writes to `students` is normalized the same way (see
// resolveStudentIdentity), so this stays reliable both ways.
export async function findStudentByEmail(supabase: SupabaseClient, email: string): Promise<StudentRow | null> {
  const { data } = await supabase
    .from("students")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return (data as StudentRow) ?? null;
}

// Finds the existing student identity for this email, or creates one.
// Always makes sure the auth account exists and students.user_id is kept
// in sync — reused by both verify routes so buying a course from either
// flow provisions a real student-hub login the same way.
export async function resolveStudentIdentity(
  supabase: SupabaseClient,
  { name, email, phone }: { name: string; email: string; phone: string }
): Promise<{ studentId: string; isNewIdentity: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findStudentByEmail(supabase, normalizedEmail);

  let studentId: string;
  if (existing) {
    studentId = existing.id;
  } else {
    studentId = newId("student");
    const { error } = await supabase.from("students").insert({
      id: studentId,
      name,
      email: normalizedEmail,
      phone,
      enrolled_at: new Date().toISOString(),
      user_id: null,
      avatar_url: null,
    });
    if (error) throw error;
  }

  // Best-effort, same as the pre-restructuring code — a broken email send
  // must never fail a verified payment.
  const provisioned = await provisionStudentAccount(email);
  if (provisioned?.userId && provisioned.userId !== existing?.user_id) {
    const { error } = await supabase.from("students").update({ user_id: provisioned.userId }).eq("id", studentId);
    if (error) console.error("Failed to link user_id for student", studentId, error);
  }

  return { studentId, isNewIdentity: !existing };
}

// Pre-payment duplicate guard for app/api/payment/create-order — block
// before a Razorpay order is even created, so the student never sees a
// checkout window for a batch they're already enrolled in.
export async function hasActiveBatchEnrollment(supabase: SupabaseClient, email: string, batchId: string): Promise<boolean> {
  const student = await findStudentByEmail(supabase, email);
  if (!student) return false;
  const { data } = await supabase
    .from("batch_enrollments")
    .select("id")
    .eq("student_id", student.id)
    .eq("batch_id", batchId)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}

// Fetches a student's full enrollment list from both tables — used
// anywhere the app needs to show "everything this person has paid for"
// (their own student-hub pages, Admin → Students).
export async function fetchStudentEnrollments(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ batchEnrollments: BatchEnrollment[]; courseEnrollments: CourseEnrollment[] }> {
  const [{ data: batchRows }, { data: courseRows }] = await Promise.all([
    supabase.from("batch_enrollments").select("*").eq("student_id", studentId).order("enrolled_at", { ascending: true }),
    supabase.from("course_enrollments").select("*").eq("student_id", studentId).order("enrolled_at", { ascending: true }),
  ]);
  return {
    batchEnrollments: ((batchRows as BatchEnrollmentRow[]) ?? []).map(batchEnrollmentFromRow),
    courseEnrollments: ((courseRows as CourseEnrollmentRow[]) ?? []).map(courseEnrollmentFromRow),
  };
}

// Same, for app/api/course-payment/create-order.
export async function hasActiveCourseEnrollment(supabase: SupabaseClient, email: string, productId: string): Promise<boolean> {
  const student = await findStudentByEmail(supabase, email);
  if (!student) return false;
  const { data } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("student_id", student.id)
    .eq("product_id", productId)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}
