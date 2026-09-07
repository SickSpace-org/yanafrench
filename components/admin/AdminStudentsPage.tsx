"use client";

import { useAdminCollection } from "@/lib/useAdminCollection";
import type { Student } from "@/lib/studentData";
import { AdminShell } from "../AdminShell";
import { AdminStudentsPanel } from "./AdminStudentsPanel";
import styles from "./AdminLessonsManager.module.css";

// The roster of confirmed, paying students, persisted in Supabase (see
// app/api/students) — created automatically the moment a Razorpay payment
// is verified (see app/api/payment/verify).
export function AdminStudentsPage() {
  const { items: students, loaded, remove } = useAdminCollection<Student>("/api/students");

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
          <AdminStudentsPanel students={students} onRemove={remove} />
        </div>
      )}
    </AdminShell>
  );
}
