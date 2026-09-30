"use client";

import type { Student } from "@/lib/studentData";
import { formatRupees } from "@/lib/formatCurrency";
import { daysOverdue, formatIndiaDate, isInstallmentLocking, isoToIndiaDate, nextPendingInstallment, todayInIndia, type EmiInstallment } from "@/lib/emiData";
import styles from "./AdminLeadsPanel.module.css";

function enrolledOn(iso: string) {
  return <span className={styles.time}>Enrolled {formatIndiaDate(isoToIndiaDate(iso))}</span>;
}

// One-line EMI status for a course enrollment bought on the EMI plan.
function EmiStatus({ plan }: { plan: EmiInstallment[] }) {
  const today = todayInIndia();
  const paid = plan.filter((i) => i.status === "paid").length;
  const next = nextPendingInstallment(plan);
  if (!next) return <span className={styles.muted}>EMI {paid}/{plan.length} paid · fully paid</span>;
  const d = daysOverdue(next.dueDate, today);
  const locked = isInstallmentLocking(next, today);
  return (
    <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: ".4rem" }}>
      <span className={styles.muted}>
        EMI {paid}/{plan.length} paid · next {formatRupees(next.amount)} due {formatIndiaDate(next.dueDate)}
      </span>
      {locked ? (
        <span className={`${styles.payment} ${styles.payment_pending}`}>Overdue {d}d · hub locked</span>
      ) : d >= 0 ? (
        <span className={`${styles.payment} ${styles.payment_pending}`}>{d === 0 ? "Due today" : `Overdue ${d}d`}</span>
      ) : null}
    </span>
  );
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

// The roster of confirmed, paying students — one row per person (login),
// not per payment. A person can hold several enrollments now (see
// lib/batchEnrollmentData.ts / lib/courseEnrollmentData.ts), so "Remove"
// is split in two: removing a single enrollment leaves the login and
// their other enrollments intact, while "Remove student" deletes the
// whole identity (cascades to all of it, see the enrollments migration).
export function AdminStudentsPanel({
  students,
  onRemove,
  onRemoveEnrollment,
  onResendSetupLink,
  sendingId,
  sentId,
  failedId,
}: {
  students: Student[];
  onRemove: (id: string) => void;
  onRemoveEnrollment: (kind: "batch" | "course", enrollmentId: string) => void;
  onResendSetupLink: (id: string) => void;
  sendingId: string | null;
  sentId: string | null;
  failedId: string | null;
}) {
  if (students.length === 0) {
    return <div className={styles.empty}>No paying students yet.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Enrollments</th>
            <th>First enrolled</th>
            <th>Login</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td className={styles.contact}>
                <a href={`tel:${s.phone}`}>{s.phone}</a>
                <a href={`mailto:${s.email}`}>{s.email}</a>
              </td>
              <td>
                {s.batchEnrollments.length === 0 && s.courseEnrollments.length === 0 ? (
                  <span className={styles.muted}>No enrollments</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: ".45rem" }}>
                    {s.batchEnrollments.map((e) => (
                      <div key={e.id} style={{ display: "flex", flexDirection: "column", gap: ".2rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                          <span className={styles.course}>{e.course}</span>
                          <span>{e.batchName}</span>
                          <button type="button" className={styles.remove} onClick={() => onRemoveEnrollment("batch", e.id)}>Remove</button>
                        </div>
                        {enrolledOn(e.enrolledAt)}
                      </div>
                    ))}
                    {s.courseEnrollments.map((e) => {
                      const plan = (s.emiInstallments ?? []).filter((i) => i.courseEnrollmentId === e.id);
                      return (
                        <div key={e.id} style={{ display: "flex", flexDirection: "column", gap: ".2rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                            <span className={styles.course}>{plan.length > 0 ? "Course · EMI" : "Course"}</span>
                            <span>{e.productTitle}</span>
                            <button type="button" className={styles.remove} onClick={() => onRemoveEnrollment("course", e.id)}>Remove</button>
                          </div>
                          {enrolledOn(e.enrolledAt)}
                          {plan.length > 0 && <EmiStatus plan={plan} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </td>
              <td className={styles.time}>{formatWhen(s.enrolledAt)}</td>
              <td>
                <button
                  type="button"
                  className={styles.action}
                  disabled={sendingId === s.id}
                  title={failedId === s.id ? "Resend couldn't deliver this — verify a sending domain at resend.com/domains, or check the server logs." : undefined}
                  onClick={() => onResendSetupLink(s.id)}
                >
                  {sendingId === s.id
                    ? "Sending…"
                    : sentId === s.id
                      ? "Sent ✓"
                      : failedId === s.id
                        ? "Not delivered ⚠"
                        : s.userId
                          ? "Resend setup link"
                          : "Send setup link"}
                </button>
              </td>
              <td>
                <button type="button" className={styles.remove} onClick={() => onRemove(s.id)}>Remove student</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
