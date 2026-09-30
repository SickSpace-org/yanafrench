import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmiReminderEmail } from "@/lib/email";
import { formatRupees } from "@/lib/formatCurrency";
import { SITE_URL } from "@/lib/site";
import {
  EMI_REMINDER_DAYS_BEFORE,
  addDays,
  emiInstallmentFromRow,
  formatIndiaDate,
  lockDate,
  reminderForToday,
  todayInIndia,
  type EmiInstallmentRow,
} from "@/lib/emiData";

// Daily EMI reminder run, triggered by the Vercel cron in vercel.json.
// For every unpaid installment it works out which email (if any) is due
// today — 5 days before, the due date, each grace day, the lock notice —
// and sends it at most once (tracked in emi_installments.reminders_sent),
// so a retried or duplicate run never double-emails anyone.
//
// Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
// set in the project's env vars; any other caller is rejected.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const today = todayInIndia();
  // Anything due within the next 5 days or already past due.
  const { data, error } = await supabase
    .from("emi_installments")
    .select("*, students(name, email)")
    .eq("status", "pending")
    .lte("due_date", addDays(today, EMI_REMINDER_DAYS_BEFORE));
  if (error) {
    console.error("[cron/emi-reminders] Failed to load installments", error);
    return new Response("Failed to load installments.", { status: 500 });
  }

  const results: { installmentId: string; kind: string; sent: boolean }[] = [];
  for (const row of (data ?? []) as (EmiInstallmentRow & { students: { name: string; email: string } | null })[]) {
    const inst = emiInstallmentFromRow(row);
    const kind = reminderForToday(inst, today);
    if (!kind || inst.remindersSent.includes(kind) || !row.students?.email) continue;

    const sent = await sendEmiReminderEmail(row.students.email, {
      name: row.students.name,
      kind,
      productTitle: inst.productTitle,
      installmentNo: inst.installmentNo,
      installmentCount: inst.installmentCount,
      amount: formatRupees(inst.amount),
      dueDate: formatIndiaDate(inst.dueDate),
      lockDate: formatIndiaDate(lockDate(inst.dueDate)),
      payUrl: `${SITE_URL}/student-hub/pay-emi`,
    });
    // Only mark it sent if delivery succeeded, so tomorrow's run doesn't
    // silently skip a reminder that never went out (exact-day kinds just
    // lapse; the lock notice retries until it's delivered).
    if (sent) {
      await supabase
        .from("emi_installments")
        .update({ reminders_sent: [...inst.remindersSent, kind] })
        .eq("id", inst.id);
    }
    results.push({ installmentId: inst.id, kind, sent });
  }

  console.log(`[cron/emi-reminders] ${today}: ${results.length} reminder(s)`, results);
  return Response.json({ today, results });
}
