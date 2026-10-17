// EMI ("pay in parts") for course-catalog purchases — shared, pure logic
// used on both sides: the checkout modal (to show the split before paying),
// the server (to charge exactly that split and schedule installments), the
// daily reminder cron, the /student-hub lock in proxy.ts, and the admin
// roster. Two schemes (see emiSchemeFor):
//   - Monthly (most courses): 30% upfront, the remaining 70% in 3 monthly
//     installments; installment n is due n months after enrolling.
//   - Two-part (DELF packages and the 2-student intensive TEF/TCF course):
//     half before the course starts, the other half after 12 sessions.
//     Course enrollments aren't tied to a batch's attendance, so that
//     second due date is an estimate (TWO_PART_ESTIMATED_DAYS after
//     enrolling) that the admin can move in Admin → EMI.
// For every scheme:
//   - Reminder emails: 5 days before, on the due date, and each of the 5
//     grace days after it.
//   - Still unpaid after those 5 grace days (i.e. from day 6) → the student
//     hub locks down to a single "pay now" page until it's paid.
// All dates are calendar dates in India time ("YYYY-MM-DD"), so "due
// today" means the same day for the student, the admin and the cron.

import type { Enrollable } from "./courseCatalogData";
import { formatRupees } from "./formatCurrency";

export const EMI_REMINDER_DAYS_BEFORE = 5;
export const EMI_GRACE_DAYS = 5;

export type PaymentPlan = "full" | "emi";

export type EmiScheme = {
  upfrontPercent: number;
  // Installments after the upfront payment.
  installmentCount: number;
  // Monthly installments are numbered "EMI 1 of 3" after the upfront part;
  // two-part plans count the upfront payment as installment 1, so the one
  // left to pay is "2 of 2".
  countsUpfront: boolean;
  due: { kind: "monthly" } | { kind: "afterSessions"; sessions: number; estimatedDays: number };
};

// ~3 classes a week → 12 sessions in about 4 weeks.
export const TWO_PART_ESTIMATED_DAYS = 28;

export const MONTHLY_EMI: EmiScheme = { upfrontPercent: 30, installmentCount: 3, countsUpfront: false, due: { kind: "monthly" } };
export const TWO_PART_EMI: EmiScheme = {
  upfrontPercent: 50,
  installmentCount: 1,
  countsUpfront: true,
  due: { kind: "afterSessions", sessions: 12, estimatedDays: TWO_PART_ESTIMATED_DAYS },
};

export type EmiInstallmentStatus = "pending" | "paid";

export type EmiInstallment = {
  id: string;
  studentId: string;
  courseEnrollmentId: string;
  productTitle: string;
  installmentNo: number;
  installmentCount: number;
  amount: number; // paise
  dueDate: string; // YYYY-MM-DD, India time
  status: EmiInstallmentStatus;
  paidAt: string | null;
  remindersSent: string[];
};

export type EmiInstallmentRow = {
  id: string;
  student_id: string;
  course_enrollment_id: string;
  product_title: string;
  installment_no: number;
  installment_count: number;
  amount: number;
  due_date: string;
  status: EmiInstallmentStatus;
  paid_at: string | null;
  reminders_sent: string[] | null;
  created_at?: string;
};

export function emiInstallmentFromRow(row: EmiInstallmentRow): EmiInstallment {
  return {
    id: row.id,
    studentId: row.student_id,
    courseEnrollmentId: row.course_enrollment_id,
    productTitle: row.product_title,
    installmentNo: row.installment_no,
    installmentCount: row.installment_count,
    amount: row.amount,
    dueDate: row.due_date,
    status: row.status,
    paidAt: row.paid_at,
    remindersSent: row.reminders_sent ?? [],
  };
}

// Which EMI scheme a product is sold on, or null when it can only be paid
// in full (the small one-off Orientation Test fees).
export function emiSchemeFor(enrollable: Enrollable): EmiScheme | null {
  if (enrollable.kind === "orientation") return null;
  if (enrollable.kind === "delf") return TWO_PART_EMI;
  return enrollable.course.emi === "twoPart" ? TWO_PART_EMI : MONTHLY_EMI;
}

export function emiAvailableFor(enrollable: Enrollable): boolean {
  return emiSchemeFor(enrollable) !== null;
}

// Splits a total (paise) into the upfront part and the installments, in
// whole rupees so no one is ever asked to pay "₹23,333.33". Any rounding
// remainder lands on the last installment, so the parts always add back up
// to the exact total.
export function splitEmi(totalPaise: number, scheme: EmiScheme): { upfront: number; installments: number[] } {
  const totalRupees = Math.round(totalPaise / 100);
  const upfrontRupees = Math.round((totalRupees * scheme.upfrontPercent) / 100);
  const rest = totalRupees - upfrontRupees;
  const count = scheme.installmentCount;
  const each = Math.floor(rest / count);
  const installments = Array.from({ length: count }, (_, i) => (i === count - 1 ? rest - each * (count - 1) : each));
  return { upfront: upfrontRupees * 100, installments: installments.map((r) => r * 100) };
}

// Due date of the i-th installment (0-based) for an enrollment on `enrolledDate`.
export function installmentDueDate(enrolledDate: string, scheme: EmiScheme, i: number): string {
  return scheme.due.kind === "monthly" ? addMonths(enrolledDate, i + 1) : addDays(enrolledDate, scheme.due.estimatedDays);
}

// One-line description of the plan for the checkout modal, emails and
// admin: "₹6,000 to start (30%), then 3 monthly EMIs of ₹4,667 / … " or
// "₹5,000 before the course starts, then ₹5,000 after 12 sessions".
export function describeEmiPlan(totalPaise: number, scheme: EmiScheme): string {
  const { upfront, installments } = splitEmi(totalPaise, scheme);
  if (scheme.due.kind === "afterSessions") {
    return `${formatRupees(upfront)} before the course starts, then ${installments.map(formatRupees).join(" / ")} after ${scheme.due.sessions} sessions`;
  }
  const amounts = installments.every((a) => a === installments[0]) ? formatRupees(installments[0]) : installments.map(formatRupees).join(" / ");
  return `${formatRupees(upfront)} to start (${scheme.upfrontPercent}%), then ${scheme.installmentCount} monthly EMIs of ${amounts}`;
}

// Short form for the admin's plan picker: "3 monthly EMIs after" /
// "second payment after 12 sessions".
export function describeRemainingEmis(scheme: EmiScheme): string {
  return scheme.due.kind === "afterSessions"
    ? `second payment after ${scheme.due.sessions} sessions`
    : `${scheme.installmentCount} monthly EMIs after`;
}

// Today's calendar date in India, as YYYY-MM-DD.
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Calendar date (India) of an ISO timestamp.
export function isoToIndiaDate(iso: string): string {
  return todayInIndia(new Date(iso));
}

// Adds whole months to a YYYY-MM-DD date, clamping to the month's last day
// (enrolled on 31 Jan → due 28/29 Feb, not 3 Mar).
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Whole days from `from` to `to` (positive when `to` is later).
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

// Days past the due date (negative = still upcoming, 0 = due today).
export function daysOverdue(dueDate: string, today: string = todayInIndia()): number {
  return daysBetween(dueDate, today);
}

export function isInstallmentLocking(inst: Pick<EmiInstallment, "status" | "dueDate">, today: string = todayInIndia()): boolean {
  return inst.status === "pending" && daysOverdue(inst.dueDate, today) > EMI_GRACE_DAYS;
}

// The date the hub locks if this installment is still unpaid.
export function lockDate(dueDate: string): string {
  return addDays(dueDate, EMI_GRACE_DAYS + 1);
}

// The earliest unpaid installment — the one "Pay next EMI" charges.
export function nextPendingInstallment<T extends Pick<EmiInstallment, "status" | "dueDate" | "installmentNo">>(installments: T[]): T | null {
  return (
    installments
      .filter((i) => i.status === "pending")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentNo - b.installmentNo)[0] ?? null
  );
}

// Which reminder (if any) is due to go out today for this installment.
// Only exact days fire, except the lock notice, which goes out once on
// the first run at or after the lock day (so a missed cron run still
// sends it).
export type EmiReminderKind = "pre5" | "due" | `grace${1 | 2 | 3 | 4 | 5}` | "locked";

export function reminderForToday(inst: Pick<EmiInstallment, "status" | "dueDate">, today: string = todayInIndia()): EmiReminderKind | null {
  if (inst.status !== "pending") return null;
  const d = daysOverdue(inst.dueDate, today);
  if (d === -EMI_REMINDER_DAYS_BEFORE) return "pre5";
  if (d === 0) return "due";
  if (d >= 1 && d <= EMI_GRACE_DAYS) return `grace${d as 1 | 2 | 3 | 4 | 5}`;
  if (d > EMI_GRACE_DAYS) return "locked";
  return null;
}

// "3 Oct 2026" — for emails and the hub.
export function formatIndiaDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
