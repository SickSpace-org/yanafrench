"use client";

import { usePortalState } from "@/lib/usePortalState";
import { AdminShell } from "../AdminShell";
import { AdminPaymentsPanel } from "./AdminPaymentsPanel";
import styles from "./AdminLessonsManager.module.css";

// Every Razorpay checkout attempt from the enroll form's payment step,
// newest first — created the moment an order is opened, patched to
// paid/failed once app/api/payment/verify confirms the signature.
export function AdminPaymentsPage() {
  const { loaded, payments, removePayment } = usePortalState();

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Payments.</h1>
        <p>Every Razorpay checkout attempt from the enroll form, including ones that didn&rsquo;t complete.</p>
      </div>

      {!loaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : (
        <div className={styles.tabPanel}>
          <AdminPaymentsPanel payments={payments} onRemove={removePayment} />
        </div>
      )}
    </AdminShell>
  );
}
