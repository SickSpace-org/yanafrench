"use client";

import type { Payment } from "@/lib/paymentData";
import styles from "./AdminLeadsPanel.module.css";

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatAmount(paise: number, currency: string) {
  return `${currency === "INR" ? "₹" : currency + " "}${(paise / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<Payment["status"], string> = {
  created: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
};

// Every Razorpay checkout attempt from the enroll form (see
// app/api/payment/create-order and app/api/payment/verify) — full account
// detail per transaction, including ones that never completed, so nothing
// gets lost between "visitor started paying" and "payment confirmed."
export function AdminPaymentsPanel({ payments, onRemove }: { payments: Payment[]; onRemove: (id: string) => void }) {
  if (payments.length === 0) {
    return <div className={styles.empty}>No payment attempts yet.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Course &amp; batch</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Order ID</th>
            <th>Payment ID</th>
            <th>Created</th>
            <th>Paid</th>
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
                <span className={styles.course}>{p.course}</span>
                <div>{p.batchName}</div>
              </td>
              <td>{formatAmount(p.amount, p.currency)}</td>
              <td>
                <span className={`${styles.payment} ${styles[`payment_${p.status === "created" ? "pending" : p.status}`] || ""}`}>
                  {STATUS_LABELS[p.status]}
                </span>
              </td>
              <td className={styles.mono}>{p.id}</td>
              <td className={styles.mono}>{p.razorpayPaymentId || <span className={styles.muted}>—</span>}</td>
              <td className={styles.time}>{formatWhen(p.createdAt)}</td>
              <td className={styles.time}>{formatWhen(p.paidAt)}</td>
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
