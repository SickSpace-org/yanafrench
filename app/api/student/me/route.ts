import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { studentFromRow, type StudentRow } from "@/lib/studentData";

// The signed-in student's own record — real identity for the student-hub
// UI (see lib/useStudentProfile.ts), replacing the old hardcoded "Amelia"
// mock. An admin previewing /student-hub has no students row of their own,
// so they get a distinct "admin-preview" shape instead of someone else's
// data or a crash.
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  if (viewer.role === "admin") {
    return Response.json({ kind: "admin-preview", email: viewer.email });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("user_id", viewer.userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load student profile", viewer.userId, error);
    return new Response("Failed to load your profile.", { status: 500 });
  }
  if (!data) {
    // A student-role account with no linked students row shouldn't be
    // possible via the normal payment/verify -> provisionStudentAccount
    // path, but could happen for one of the pre-existing backfilled
    // accounts before their row is linked.
    return new Response("No student record is linked to this account yet.", { status: 404 });
  }

  return Response.json({ kind: "student", student: studentFromRow(data as StudentRow) });
}
