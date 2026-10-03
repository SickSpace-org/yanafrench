"use client";

import type { Student } from "@/lib/studentData";
import { formatRupees } from "@/lib/formatCurrency";
import { daysOverdue, formatIndiaDate, isoToIndiaDate, lockDate, nextPendingInstallment, EMI_GRACE_DAYS, type EmiInstallment } from "@/lib/emiData";
import { emiWhatsappMessage, useStudentEmi } from "@/lib/useStudentEmi";
import { whatsappUrl } from "@/lib/site";
import styles from "./EmiPayments.module.css";

function DueChip({ inst, today }: { inst: EmiInstallment; today: string }) {
  const d = daysOverdue(inst.dueDate, today);
  if (d < 0) return <span className={`${styles.chip} ${styles.chipSoon}`}>Due in {-d} {d === -1 ? "day" : "days"}</span>;
  if (d === 0) return <span className={`${styles.chip} ${styles.chipWarn}`}>Due today</span>;
  if (d <= EMI_GRACE_DAYS) return <span className={`${styles.chip} ${styles.chipWarn}`}>Overdue — hub locks on {formatIndiaDate(lockDate(inst.dueDate))}</span>;
  return <span className={`${styles.chip} ${styles.chipWarn}`}>Overdue</span>;
}

// Dashboard card: every enrollment with the date it started, and for EMI
// purchases how many installments are paid, the next payment date, and a
// "Pay on WhatsApp" button for the earliest unpaid one — payment goes to
// Yana directly, and she marks it paid in Admin → EMI.
export function EmiPaymentsCard({ student }: { student: Student }) {
  const emi = useStudentEmi();

  const next = nextPendingInstallment(emi.installments);
  const byEnrollment = new Map<string, EmiInstallment[]>();
  for (const inst of emi.installments) {
    const list = byEnrollment.get(inst.courseEnrollmentId) ?? [];
    list.push(inst);
    byEnrollment.set(inst.courseEnrollmentId, list);
  }

  const enrollments = [
    ...student.batchEnrollments.filter((e) => e.status === "active").map((e) => ({ id: e.id, title: `${e.course} · ${e.batchName}`, enrolledAt: e.enrolledAt })),
    ...student.courseEnrollments.filter((e) => e.status === "active").map((e) => ({ id: e.id, title: e.productTitle, enrolledAt: e.enrolledAt })),
  ].sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt));

  if (enrollments.length === 0) return null;

  return (
    <section className={styles.card} aria-label="Your enrollments and payments">
      <span className={styles.label}>YOUR ENROLLMENTS &amp; PAYMENTS</span>
      <ul className={styles.list}>
        {enrollments.map((e) => {
          const plan = byEnrollment.get(e.id);
          const pending = plan ? nextPendingInstallment(plan) : null;
          const paidCount = plan ? plan.filter((i) => i.status === "paid").length : 0;
          return (
            <li key={e.id} className={styles.item}>
              <div className={styles.itemMain}>
                <span className={styles.itemTitle}>{e.title}</span>
                <span className={styles.itemMeta}>Enrolled on <strong>{formatIndiaDate(isoToIndiaDate(e.enrolledAt))}</strong></span>
                {plan && (
                  <span className={styles.itemMeta}>
                    EMI {paidCount} of {plan.length} paid
                    {pending ? (
                      <> · Next payment <strong>{formatRupees(pending.amount)}</strong> on <strong>{formatIndiaDate(pending.dueDate)}</strong></>
                    ) : (
                      " · Fully paid"
                    )}
                  </span>
                )}
              </div>
              {plan && pending && emi.today && <DueChip inst={pending} today={emi.today} />}
              {plan && !pending && <span className={`${styles.chip} ${styles.chipOk}`}>Paid ✓</span>}
              {pending && next && pending.id === next.id && (
                <a className={styles.pay} href={whatsappUrl(emiWhatsappMessage(pending))} target="_blank" rel="noreferrer">
                  Pay on WhatsApp · {formatRupees(pending.amount)}
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {next && <p className={styles.itemMeta}>Pay Yana on WhatsApp — your EMI shows as paid here once she confirms it.</p>}
    </section>
  );
}
