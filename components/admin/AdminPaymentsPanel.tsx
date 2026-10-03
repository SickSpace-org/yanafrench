"use client";

import type { AdminPayment } from "@/lib/enrollmentRequestData";
import styles from "./AdminLeadsPanel.module.css";

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatAmount(paise: number, currency: string) {
  return `${currency === "INR" ? "₹" : currency + " "}${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const STATUS_LABELS: Record<AdminPayment["status"], string> = {
  created: "Not completed",
  paid: "Paid",
  failed: "Failed",
};

// Admin → Payments: payments confirmed by hand in Admin → Enrollments,
// plus older online (Razorpay) ones — batch and course together.
export function AdminPaymentsPanel({ payments, onRemove }: { payments: AdminPayment[]; onRemove: (id: string) => void }) {
  if (payments.length === 0) {
    return <div className={styles.empty}>No payments yet — confirm one from Enrollments once you&rsquo;ve received it.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Course</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Received</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td className={styles.contact}>
                <a href={`tel:${p.phone}`}>{p.phone}</a>
                <a href={`mailto:${p.email}`}>{p.email}</a>
              </td>
              <td>
                <span className={styles.course}>{p.kind === "batch" ? p.title : "Course"}</span>
                <div>{p.kind === "batch" ? p.detail : p.title}</div>
              </td>
              <td>
                {formatAmount(p.amount, p.currency)}
                <div className={styles.muted}>{p.plan === "emi" ? "EMI — first payment" : "Full payment"}</div>
              </td>
              <td>
                <span className={`${styles.payment} ${styles[`payment_${p.status === "created" ? "failed" : p.status === "failed" ? "pending" : "paid"}`]}`}>
                  {STATUS_LABELS[p.status]}
                </span>
                <div className={styles.method}>{p.method === "manual" ? "Confirmed by admin" : "Online (Razorpay)"}</div>
              </td>
              <td className={styles.time}>{formatWhen(p.paidAt ?? p.createdAt)}</td>
              <td>
                <button type="button" className={styles.remove} onClick={() => onRemove(p.id)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
