import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { fetchStudentInstallments } from "@/lib/emi";
import { enrollablePriceInPaise, findEnrollableByProductId } from "@/lib/courseCatalogData";
import { nextPendingInstallment, todayInIndia } from "@/lib/emiData";
import type { MyCourse } from "@/lib/myCourseData";

// GET → Student hub → My Course: each active enrollment with what the
// student has paid (the first payment — confirmed by Yana or, for older
// ones, online — plus every EMI paid since), the course fee, and the EMI
// schedule with the next one due. An admin previewing the hub gets an
// empty list.
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }
  const today = todayInIndia();
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", viewer.userId).maybeSingle();
  if (!student) return Response.json({ courses: [], today, preview: viewer.role === "admin" });

  const [{ data: batchRows }, { data: courseRows }, installments] = await Promise.all([
    supabase.from("batch_enrollments").select("*").eq("student_id", student.id).eq("status", "active"),
    supabase.from("course_enrollments").select("*").eq("student_id", student.id).eq("status", "active"),
    fetchStudentInstallments(supabase, student.id),
  ]);

  const paymentIds = [...(batchRows ?? []), ...(courseRows ?? [])].map((r) => r.payment_id as string).filter(Boolean);
  const [{ data: batchPays }, { data: coursePays }] = await Promise.all([
    paymentIds.length ? supabase.from("payments").select("id, amount, status").in("id", paymentIds) : Promise.resolve({ data: [] }),
    paymentIds.length ? supabase.from("course_payments").select("id, amount, status, plan").in("id", paymentIds) : Promise.resolve({ data: [] }),
  ]);
  const paid = new Map<string, { amount: number; plan?: string }>();
  for (const p of [...(batchPays ?? []), ...(coursePays ?? [])] as { id: string; amount: number; status: string; plan?: string }[]) {
    if (p.status === "paid") paid.set(p.id, { amount: p.amount, plan: p.plan });
  }

  const courses: MyCourse[] = [
    ...(courseRows ?? []).map((row) => {
      const plan = installments.filter((i) => i.courseEnrollmentId === row.id).sort((a, b) => a.installmentNo - b.installmentNo);
      const first = paid.get(row.payment_id);
      const emiPaid = plan.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
      const enrollable = findEnrollableByProductId(row.product_id);
      return {
        id: row.id as string,
        kind: "course" as const,
        title: row.product_title as string,
        detail: null,
        enrolledAt: row.enrolled_at as string,
        plan: plan.length > 0 || first?.plan === "emi" ? ("emi" as const) : ("full" as const),
        feePaise: enrollable ? enrollablePriceInPaise(enrollable) : null,
        paidPaise: (first?.amount ?? 0) + emiPaid,
        installments: plan,
        next: nextPendingInstallment(plan),
      };
    }),
    ...(batchRows ?? []).map((row) => ({
      id: row.id as string,
      kind: "batch" as const,
      title: row.course as string,
      detail: row.batch_name as string,
      enrolledAt: row.enrolled_at as string,
      plan: "full" as const,
      feePaise: null,
      paidPaise: paid.get(row.payment_id)?.amount ?? 0,
      installments: [],
      next: null,
    })),
  ].sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt));

  return Response.json({ courses, today, preview: false }, { headers: { "Cache-Control": "no-store" } });
}
