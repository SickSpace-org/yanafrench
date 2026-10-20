// EMI ("pay in parts") for course-catalog purchases — shared, pure logic
// used on both sides: the checkout modal (to show the split before paying),
// the server (to charge exactly that split and schedule installments), the
// daily reminder cron, the /student-hub lock in proxy.ts, and the admin
// roster. A product's EMI plan is an ordered list of payments — the first
// is paid at enrollment, each later one falls due a set time after
// enrolling. Admin → EMI Plans can set any plan per product (stored by
// lib/emiSettingsServer.ts); without one, the defaults are:
//   - Most courses: 30% upfront, the remaining 70% in 3 monthly payments.
//   - DELF packages and the 2-student intensive TEF/TCF course: half before
//     the course starts, the other half after 12 sessions. Course
//     enrollments aren't tied to a batch's attendance, so that date is an
//     estimate (TWO_PART_ESTIMATED_DAYS after enrolling) that the admin can
//     move in Admin → EMI.
// Installment rows are numbered counting the upfront payment, so the second
// payment of a 4-payment plan is "EMI 2 of 4". (Enrollments made on the
// original monthly scheme are numbered 1–3 of 3.) Admin → EMI can also
// rewrite any existing student's remaining payments.
// For every plan:
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

// One payment of a plan. Every payment but the first (paid at enrollment)
// has afterMonths or afterDays; `note` replaces the generic timing in
// descriptions ("after 12 sessions").
export type EmiPlanPayment = { amount: number; afterMonths?: number; afterDays?: number; note?: string };
export type EmiPlan = EmiPlanPayment[];

// What Admin → EMI Plans stores per productId. A single payment (or
// enabled: false) means "pay in full only".
export type EmiSetting = {
  enabled: boolean;
  payments: { rupees: number; afterDays: number; note?: string }[];
};
export type EmiSettings = Record<string, EmiSetting>;

export const EMI_MAX_PAYMENTS = 12;
export const EMI_NOTE_MAX = 60;

// ~3 classes a week → 12 sessions in about 4 weeks.
export const TWO_PART_ESTIMATED_DAYS = 28;

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

// Splits whole rupees into `count` parts, any remainder on the last, so no
// one is ever asked to pay "₹23,333.33" and the parts add back up exactly.
export function splitRupees(totalRupees: number, count: number): number[] {
  const each = Math.floor(totalRupees / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? totalRupees - each * (count - 1) : each));
}

// The built-in plan for a product when Admin → EMI Plans hasn't set one;
// null when it can only be paid in full (the small Orientation Test fees).
export function defaultEmiPlan(enrollable: Enrollable, totalPaise: number): EmiPlan | null {
  if (enrollable.kind === "orientation") return null;
  const totalRupees = Math.round(totalPaise / 100);
  if (enrollable.kind === "delf" || enrollable.course.emi === "twoPart") {
    const [first, second] = splitRupees(totalRupees, 2);
    return [{ amount: first * 100 }, { amount: second * 100, afterDays: TWO_PART_ESTIMATED_DAYS, note: "after 12 sessions" }];
  }
  const upfront = Math.round(totalRupees * 0.3);
  return [{ amount: upfront * 100 }, ...splitRupees(totalRupees - upfront, 3).map((r, i) => ({ amount: r * 100, afterMonths: i + 1 }))];
}

// Why an admin setting can't be used at this price, or null if it can. Its
// payments must add up to the fee exactly and fall due in order — a
// setting that no longer fits (say the fee changed after it was saved) is
// ignored in favour of the default plan.
export function emiSettingProblem(setting: EmiSetting, totalPaise: number): string | null {
  const { payments } = setting;
  if (!Array.isArray(payments) || payments.length === 0) return "Add at least one payment.";
  if (!setting.enabled || payments.length < 2) return null;
  if (payments.length > EMI_MAX_PAYMENTS) return `At most ${EMI_MAX_PAYMENTS} payments.`;
  for (const [i, p] of payments.entries()) {
    if (!Number.isInteger(p.rupees) || p.rupees < 1) return `Payment ${i + 1} needs an amount of at least ₹1.`;
    if (i > 0 && (!Number.isInteger(p.afterDays) || p.afterDays < 1)) return `Payment ${i + 1} needs to be due at least 1 day after enrolling.`;
    if (i > 1 && p.afterDays <= payments[i - 1].afterDays) return `Payment ${i + 1} must fall due after payment ${i}.`;
    if ((p.note ?? "").length > EMI_NOTE_MAX) return `Payment ${i + 1}'s note is too long (max ${EMI_NOTE_MAX} characters).`;
  }
  const sum = payments.reduce((s, p) => s + p.rupees, 0);
  const total = Math.round(totalPaise / 100);
  if (sum !== total) return `The payments add up to ${formatRupees(sum * 100)}, but the course fee is ${formatRupees(total * 100)}.`;
  return null;
}

// An admin plan carried over to a new fee when the course price changes:
// every payment scales in proportion (to whole rupees, the last one taking
// the remainder), keeping the timing. null when it can't be scaled sensibly,
// in which case the default plan applies.
export function rescaleEmiSetting(setting: EmiSetting, oldTotalRupees: number, newTotalRupees: number): EmiSetting | null {
  const { payments } = setting;
  if (!setting.enabled || payments.length < 2 || oldTotalRupees < 1) return setting;
  const scaled = payments.map((p) => Math.round((p.rupees * newTotalRupees) / oldTotalRupees));
  scaled[scaled.length - 1] = newTotalRupees - scaled.slice(0, -1).reduce((s, r) => s + r, 0);
  if (scaled.some((r) => r < 1)) return null;
  return { ...setting, payments: payments.map((p, i) => ({ ...p, rupees: scaled[i] })) };
}

// The plan a product is sold on right now (null = pay in full only): the
// admin's setting when there's a usable one, otherwise the default.
export function resolveEmiPlan(enrollable: Enrollable, totalPaise: number, setting: EmiSetting | undefined): EmiPlan | null {
  if (enrollable.kind === "orientation") return null;
  if (!setting || emiSettingProblem(setting, totalPaise)) return defaultEmiPlan(enrollable, totalPaise);
  if (!setting.enabled || setting.payments.length < 2) return null;
  return setting.payments.map((p, i) => ({
    amount: p.rupees * 100,
    ...(i > 0 ? { afterDays: p.afterDays } : {}),
    ...(p.note?.trim() ? { note: p.note.trim() } : {}),
  }));
}

// A plan in the EMI Plans editor's shape (months become 30-day steps).
export function planToSetting(plan: EmiPlan | null, totalPaise: number): EmiSetting {
  if (!plan) return { enabled: false, payments: [{ rupees: Math.round(totalPaise / 100), afterDays: 0 }] };
  return {
    enabled: true,
    payments: plan.map((p, i) => ({
      rupees: Math.round(p.amount / 100),
      afterDays: i === 0 ? 0 : p.afterDays ?? (p.afterMonths ?? 0) * 30,
      ...(p.note ? { note: p.note } : {}),
    })),
  };
}

// Due date of a plan payment for an enrollment on `enrolledDate`.
export function planPaymentDueDate(enrolledDate: string, payment: EmiPlanPayment): string {
  if (payment.afterMonths) return addMonths(enrolledDate, payment.afterMonths);
  return addDays(enrolledDate, payment.afterDays ?? 0);
}

function paymentTiming(p: EmiPlanPayment): string {
  if (p.note) return p.note;
  if (p.afterMonths) return `after ${p.afterMonths} ${p.afterMonths === 1 ? "month" : "months"}`;
  return `after ${p.afterDays} ${p.afterDays === 1 ? "day" : "days"}`;
}

// One-line description of the plan for the checkout modal, emails and
// admin: "₹6,000 to start, then 3 monthly EMIs of ₹4,666 / ₹4,666 / ₹4,668"
// or "₹5,000 to start, then ₹5,000 after 12 sessions".
export function describeEmiPlan(plan: EmiPlan): string {
  const [first, ...rest] = plan;
  if (rest.every((p, i) => p.afterMonths === i + 1 && !p.note)) {
    const amounts = rest.every((p) => p.amount === rest[0].amount) ? formatRupees(rest[0].amount) : rest.map((p) => formatRupees(p.amount)).join(" / ");
    return `${formatRupees(first.amount)} to start, then ${rest.length} monthly ${rest.length === 1 ? "EMI" : "EMIs"} of ${amounts}`;
  }
  return `${formatRupees(first.amount)} to start, then ${rest.map((p) => `${formatRupees(p.amount)} ${paymentTiming(p)}`).join(", ")}`;
}

// Short form for the admin's plan picker: "3 more payments after".
export function describeRemainingEmis(plan: EmiPlan): string {
  const n = plan.length - 1;
  return n === 1 ? `1 more payment, ${paymentTiming(plan[1])}` : `${n} more payments after`;
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
