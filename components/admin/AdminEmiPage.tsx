"use client";

import { useMemo } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import { formatRupees } from "@/lib/formatCurrency";
import {
  daysOverdue,
  formatIndiaDate,
  isInstallmentLocking,
  isoToIndiaDate,
  lockDate,
  nextPendingInstallment,
  todayInIndia,
  type EmiInstallment,
} from "@/lib/emiData";
import type { Student } from "@/lib/studentData";
import { AdminShell } from "../AdminShell";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import emiStyles from "./AdminEmiPage.module.css";

type Plan = {
  key: string;
  student: Student;
  productTitle: string;
  installments: EmiInstallment[];
  next: EmiInstallment | null;
};

// One plan per (student, course enrollment) bought on EMI, built from the
// installments /api/students already attaches to each student. Plans with
// money still owed come first, earliest next due date on top (so overdue
// ones lead); fully paid plans sink to the bottom.
function buildPlans(students: Student[]): Plan[] {
  const plans: Plan[] = [];
  for (const student of students) {
    const byEnrollment = new Map<string, EmiInstallment[]>();
    for (const inst of student.emiInstallments ?? []) {
      const list = byEnrollment.get(inst.courseEnrollmentId) ?? [];
      list.push(inst);
      byEnrollment.set(inst.courseEnrollmentId, list);
    }
    for (const [enrollmentId, installments] of byEnrollment) {
      installments.sort((a, b) => a.installmentNo - b.installmentNo);
      plans.push({
        key: enrollmentId,
        student,
        productTitle: installments[0].productTitle,
        installments,
        next: nextPendingInstallment(installments),
      });
    }
  }
  return plans.sort((a, b) => {
    if (!a.next || !b.next) return a.next ? -1 : b.next ? 1 : a.student.name.localeCompare(b.student.name);
    return a.next.dueDate.localeCompare(b.next.dueDate) || a.student.name.localeCompare(b.student.name);
  });
}

function NextStatus({ next, today }: { next: EmiInstallment | null; today: string }) {
  if (!next) return <span className={`${leadStyles.payment} ${leadStyles.payment_paid}`}>Fully paid</span>;
  const d = daysOverdue(next.dueDate, today);
  if (isInstallmentLocking(next, today)) {
    return <span className={`${leadStyles.payment} ${leadStyles.payment_pending}`}>Overdue {d}d · hub locked</span>;
  }
  if (d > 0) {
    return (
      <span className={`${leadStyles.payment} ${leadStyles.payment_pending}`}>
        Overdue {d}d · locks {formatIndiaDate(lockDate(next.dueDate))}
      </span>
    );
  }
  if (d === 0) return <span className={`${leadStyles.payment} ${leadStyles.payment_pending}`}>Due today</span>;
  return <span className={leadStyles.time}>in {-d} {d === -1 ? "day" : "days"}</span>;
}

export function AdminEmiPage() {
  const { items: students, loaded } = useAdminCollection<Student>("/api/students");
  const plans = useMemo(() => buildPlans(students), [students]);
  const today = todayInIndia();

  const active = plans.filter((p) => p.next);
  const overdue = active.filter((p) => daysOverdue(p.next!.dueDate, today) > 0).length;
  const dueThisWeek = active.filter((p) => {
    const d = daysOverdue(p.next!.dueDate, today);
    return d <= 0 && d >= -7;
  }).length;
  const outstanding = plans.reduce(
    (sum, p) => sum + p.installments.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0),
    0
  );

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>EMI.</h1>
        <p>Students paying in installments — what they&rsquo;ve paid, and when their next payment is due.</p>
      </div>

      {!loaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : plans.length === 0 ? (
        <div className={styles.tabPanel}>
          <div className={leadStyles.empty}>No students on the EMI plan yet.</div>
        </div>
      ) : (
        <>
          <div className={emiStyles.stats}>
            <div className={emiStyles.stat}><span>{active.length}</span>Active plans</div>
            <div className={emiStyles.stat}><span>{dueThisWeek}</span>Due in next 7 days</div>
            <div className={emiStyles.stat}><span className={overdue > 0 ? emiStyles.alert : undefined}>{overdue}</span>Overdue</div>
            <div className={emiStyles.stat}><span>{formatRupees(outstanding)}</span>Still to collect</div>
          </div>

          <div className={styles.tabPanel}>
            <div style={{ overflowX: "auto" }}>
              <table className={leadStyles.table}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Next payment</th>
                    <th>Status</th>
                    <th>Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const paid = p.installments.filter((i) => i.status === "paid").length;
                    return (
                      <tr key={p.key}>
                        <td>
                          <div className={emiStyles.name}>{p.student.name}</div>
                          <div className={leadStyles.contact}>
                            <a href={`tel:${p.student.phone}`}>{p.student.phone}</a>
                            <a href={`mailto:${p.student.email}`}>{p.student.email}</a>
                          </div>
                        </td>
                        <td>
                          {p.productTitle}
                          <div className={leadStyles.muted}>{paid}/{p.installments.length} installments paid</div>
                        </td>
                        <td>
                          {p.next ? (
                            <>
                              <div className={emiStyles.nextDate}>{formatIndiaDate(p.next.dueDate)}</div>
                              <div className={leadStyles.muted}>
                                {formatRupees(p.next.amount)} · installment {p.next.installmentNo}/{p.next.installmentCount}
                              </div>
                            </>
                          ) : (
                            <span className={leadStyles.muted}>—</span>
                          )}
                        </td>
                        <td><NextStatus next={p.next} today={today} /></td>
                        <td>
                          <ul className={emiStyles.schedule}>
                            {p.installments.map((i) => (
                              <li key={i.id} className={i.status === "paid" ? emiStyles.paid : undefined}>
                                <span>#{i.installmentNo}</span>
                                <span>{formatIndiaDate(i.dueDate)}</span>
                                <span>{formatRupees(i.amount)}</span>
                                <span>{i.status === "paid" && i.paidAt ? `Paid ${formatIndiaDate(isoToIndiaDate(i.paidAt))}` : i.status === "paid" ? "Paid" : "Pending"}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
