// EMI ("pay in parts") for course-catalog purchases — shared, pure logic
// used on both sides: the checkout modal (to show the split before paying),
// the server (to charge exactly that split and schedule installments), the
// daily reminder cron, the /student-hub lock in proxy.ts, and the admin
// roster. Rules:
//   - 30% upfront at checkout, the remaining 70% in 3 monthly installments.
//   - Installment n is due n months after the enrollment date.
//   - Reminder emails: 5 days before, on the due date, and each of the 5
//     grace days after it.
//   - Still unpaid after those 5 grace days (i.e. from day 6) → the student
//     hub locks down to a single "pay now" page until it's paid.
// All dates are calendar dates in India time ("YYYY-MM-DD"), so "due
// today" means the same day for the student, the admin and the cron.

import type { Enrollable } from "./courseCatalogData";

export const EMI_UPFRONT_PERCENT = 30;
export const EMI_INSTALLMENT_COUNT = 3;
export const EMI_REMINDER_DAYS_BEFORE = 5;
export const EMI_GRACE_DAYS = 5;

export type PaymentPlan = "full" | "emi";

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

// EMI is offered on the full courses and DELF packages — not on the small
// one-off Orientation Test fees.
export function emiAvailableFor(enrollable: Enrollable): boolean {
  return enrollable.kind !== "orientation";
}

// Splits a total (paise) into the upfront part and the 3 installments,
// in whole rupees so no one is ever asked to pay "₹23,333.33". Any
// rounding remainder lands on the last installment, so the parts always
// add back up to the exact total.
export function splitEmi(totalPaise: number): { upfront: number; installments: number[] } {
  const totalRupees = Math.round(totalPaise / 100);
  const upfrontRupees = Math.round((totalRupees * EMI_UPFRONT_PERCENT) / 100);
  const rest = totalRupees - upfrontRupees;
  const each = Math.floor(rest / EMI_INSTALLMENT_COUNT);
  const installments = Array.from({ length: EMI_INSTALLMENT_COUNT }, (_, i) =>
    i === EMI_INSTALLMENT_COUNT - 1 ? rest - each * (EMI_INSTALLMENT_COUNT - 1) : each
  );
  return { upfront: upfrontRupees * 100, installments: installments.map((r) => r * 100) };
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
