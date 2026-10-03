import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { listAdminPayments } from "@/lib/enrollmentRequests";

// GET: Admin → Payments — batch and course payments together (payments
// confirmed by hand in Admin → Enrollments, plus older Razorpay ones),
// newest first. Rows are written only by the confirm flow (and, before it,
// the Razorpay checkout routes) — no public POST here.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  try {
    return Response.json(await listAdminPayments(supabase));
  } catch (error) {
    console.error("Failed to list payments", error);
    return new Response("Failed to load payments.", { status: 500 });
  }
}
