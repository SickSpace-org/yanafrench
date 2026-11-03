"use client";

import { useAdminCollection } from "@/lib/useAdminCollection";
import type { Student } from "@/lib/studentData";
import { AdminShell } from "../AdminShell";
import { AdminPaymentsPanel } from "./AdminPaymentsPanel";
import styles from "./AdminLessonsManager.module.css";

// Every student from the Students tab (see app/api/students) with editable
// payment amounts: first payment, EMIs and total paid.
export function AdminPaymentsPage() {
  const { items: students, loaded, refresh } = useAdminCollection<Student>("/api/students");

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Payments.</h1>
        <p>Every student with what they&rsquo;ve paid and their EMIs. Click any amount to edit it.</p>
      </div>

      {!loaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : (
        <div className={styles.tabPanel}>
          <AdminPaymentsPanel students={students} onChanged={refresh} />
        </div>
      )}
    </AdminShell>
  );
}
