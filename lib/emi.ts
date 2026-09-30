// Server-side EMI operations (see lib/emiData.ts for the rules and pure
// date/amount logic). Service-role client only — emi_installments and
// emi_payments have RLS on with no policies.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMI_INSTALLMENT_COUNT,
  addMonths,
  emiInstallmentFromRow,
  isInstallmentLocking,
  isoToIndiaDate,
  splitEmi,
  todayInIndia,
  type EmiInstallment,
  type EmiInstallmentRow,
} from "./emiData";

// Creates the 3 monthly installments for an EMI course enrollment, sized
// from the product's full price. Idempotent: (course_enrollment_id,
// installment_no) is unique, so a second call (browser verify + webhook
// both fulfilling the same upfront payment) inserts nothing new.
export async function createInstallmentsForEnrollment(
  supabase: SupabaseClient,
  input: { studentId: string; courseEnrollmentId: string; productTitle: string; totalPaise: number; enrolledAt: string }
) {
  const { installments } = splitEmi(input.totalPaise);
  const enrolledDate = isoToIndiaDate(input.enrolledAt);
  const rows = installments.map((amount, i) => ({
    id: `emi-${input.courseEnrollmentId}-${i + 1}`,
    student_id: input.studentId,
    course_enrollment_id: input.courseEnrollmentId,
    product_title: input.productTitle,
    installment_no: i + 1,
    installment_count: EMI_INSTALLMENT_COUNT,
    amount,
    due_date: addMonths(enrolledDate, i + 1),
    status: "pending",
  }));
  const { error } = await supabase
    .from("emi_installments")
    .upsert(rows, { onConflict: "course_enrollment_id,installment_no", ignoreDuplicates: true });
  if (error) console.error("Failed to create EMI installments for", input.courseEnrollmentId, error);
}

export async function fetchStudentInstallments(supabase: SupabaseClient, studentId: string): Promise<EmiInstallment[]> {
  const { data, error } = await supabase
    .from("emi_installments")
    .select("*")
    .eq("student_id", studentId)
    .order("due_date", { ascending: true })
    .order("installment_no", { ascending: true });
  if (error) {
    console.error("Failed to load EMI installments for", studentId, error);
    return [];
  }
  return ((data as EmiInstallmentRow[]) ?? []).map(emiInstallmentFromRow);
}

// Is this signed-in user's student hub locked for an overdue EMI? Used by
// proxy.ts on every /student-hub navigation. Fails open (unlocked) if the
// lookup itself errors — a database hiccup must never lock out a student
// who has paid.
export async function isStudentHubLocked(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: student } = await supabase.from("students").select("id").eq("user_id", userId).maybeSingle();
  if (!student) return false;
  const { data, error } = await supabase
    .from("emi_installments")
    .select("status, due_date")
    .eq("student_id", student.id)
    .eq("status", "pending");
  if (error || !data) return false;
  const today = todayInIndia();
  return data.some((row) => isInstallmentLocking({ status: row.status, dueDate: row.due_date }, today));
}

// Marks an EMI order paid and its installment settled. Shared by
// app/api/emi/verify (browser callback) and the Razorpay webhook, same
// once-only pattern as lib/paymentFulfillment.ts.
export async function fulfillEmiPayment(
  supabase: SupabaseClient,
  orderId: string,
  razorpayPaymentId: string
): Promise<{ fulfilled: boolean }> {
  const { data: payment } = await supabase.from("emi_payments").select("*").eq("id", orderId).maybeSingle();
  if (!payment) return { fulfilled: false };

  const paidAt = new Date().toISOString();
  await supabase
    .from("emi_payments")
    .update({ status: "paid", razorpay_payment_id: razorpayPaymentId, paid_at: paidAt })
    .eq("id", orderId);

  const { data: updated, error } = await supabase
    .from("emi_installments")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", payment.installment_id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) console.error("Failed to mark EMI installment paid", payment.installment_id, error);
  return { fulfilled: !!updated };
}
