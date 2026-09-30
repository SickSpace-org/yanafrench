import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { fetchStudentInstallments } from "@/lib/emi";
import { isInstallmentLocking, todayInIndia } from "@/lib/emiData";

// The signed-in student's EMI schedule, for the hub's payments card and
// the locked pay-now page. `locked` uses the same rule proxy.ts enforces.
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }
  if (viewer.role === "admin") return Response.json({ installments: [], locked: false, today: todayInIndia() });

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", viewer.userId).maybeSingle();
  if (!student) return Response.json({ installments: [], locked: false, today: todayInIndia() });

  const installments = await fetchStudentInstallments(supabase, student.id);
  const today = todayInIndia();
  return Response.json({ installments, locked: installments.some((i) => isInstallmentLocking(i, today)), today });
}
