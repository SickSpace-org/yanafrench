import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { studentFromRow, type StudentRow } from "@/lib/studentData";
import { batchEnrollmentFromRow, type BatchEnrollmentRow } from "@/lib/batchEnrollmentData";
import { courseEnrollmentFromRow, type CourseEnrollmentRow } from "@/lib/courseEnrollmentData";

// GET: the roster of confirmed, paying students for Admin → Students,
// newest first, each with every batch/course enrollment they hold — one
// person can have several (see lib/enrollment.ts). Rows are only ever
// written by lib/enrollment.ts's resolveStudentIdentity on a successfully
// verified payment — no public POST here.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const [{ data: students, error }, { data: batchRows }, { data: courseRows }] = await Promise.all([
    supabase.from("students").select("*").order("enrolled_at", { ascending: false }),
    supabase.from("batch_enrollments").select("*"),
    supabase.from("course_enrollments").select("*"),
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

  const result = (students as StudentRow[]).map((row) =>
    studentFromRow(
      row,
      (batchesByStudent.get(row.id) ?? []).map(batchEnrollmentFromRow),
      (coursesByStudent.get(row.id) ?? []).map(courseEnrollmentFromRow)
    )
  );

  return Response.json(result);
}
