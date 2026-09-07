"use client";

import { usePortalState } from "@/lib/usePortalState";
import { AdminShell } from "../AdminShell";
import { AdminStudentsPanel } from "./AdminStudentsPanel";
import styles from "./AdminLessonsManager.module.css";

// The roster of confirmed, paying students — created automatically the
// moment a Razorpay payment is verified (see app/api/payment/verify).
export function AdminStudentsPage() {
  const { loaded, students, removeStudent } = usePortalState();

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Students.</h1>
        <p>Everyone who has actually paid to enroll, newest first.</p>
      </div>

      {!loaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : (
        <div className={styles.tabPanel}>
          <AdminStudentsPanel students={students} onRemove={removeStudent} />
        </div>
      )}
    </AdminShell>
  );
}
