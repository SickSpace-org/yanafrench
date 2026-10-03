import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { listEnrollmentRequests } from "@/lib/enrollmentRequests";

// GET: Admin → Enrollments — every website enroll-form submission (batch
// and course) whose payment hasn't been confirmed yet, newest first.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  try {
    return Response.json(await listEnrollmentRequests(supabase));
  } catch (error) {
    console.error("Failed to list enrollment requests", error);
    return new Response("Failed to load enrollments.", { status: 500 });
  }
}
