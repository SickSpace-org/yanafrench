import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { confirmEnrollmentPayment, ConfirmError } from "@/lib/enrollmentRequests";

// POST { amountRupees, plan } → Admin → Enrollments' "Payment received":
// records the payment and enrolls the student (see
// lib/enrollmentRequests.ts). The request then leaves Enrollments and
// shows up under Payments, Students and (on a plan) EMI.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = (await req.json().catch(() => null)) as { amountRupees?: unknown; plan?: unknown } | null;
  const rupees = Number(body?.amountRupees);
  if (!Number.isFinite(rupees) || rupees <= 0 || rupees > 10_000_000) {
    return new Response("Enter the amount received.", { status: 400 });
  }
  const plan = body?.plan === "emi" ? "emi" : "full";

  const { id } = await params;
  try {
    await confirmEnrollmentPayment(supabase, id, { amountPaise: Math.round(rupees * 100), plan });
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ConfirmError) return new Response(err.message, { status: err.status });
    console.error("Failed to confirm enrollment payment", id, err);
    return new Response("Couldn't confirm the payment. Please try again.", { status: 500 });
  }
}
