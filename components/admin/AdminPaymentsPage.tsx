"use client";

import { useAdminCollection } from "@/lib/useAdminCollection";
import type { AdminPayment } from "@/lib/enrollmentRequestData";
import { AdminShell } from "../AdminShell";
import { AdminPaymentsPanel } from "./AdminPaymentsPanel";
import styles from "./AdminLessonsManager.module.css";

// Every payment, batch and course, newest first (see app/api/payments) —
// mostly ones confirmed by hand from Admin → Enrollments.
export function AdminPaymentsPage() {
  const { items: payments, loaded, remove } = useAdminCollection<AdminPayment>("/api/payments");

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Payments.</h1>
        <p>Every payment you&rsquo;ve confirmed from Enrollments, newest first, plus older online payments.</p>
      </div>

      {!loaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : (
        <div className={styles.tabPanel}>
          <AdminPaymentsPanel payments={payments} onRemove={remove} />
        </div>
      )}
    </AdminShell>
  );
}
