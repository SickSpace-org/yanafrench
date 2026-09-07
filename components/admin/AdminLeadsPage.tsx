"use client";

import { useAdminCollection } from "@/lib/useAdminCollection";
import type { Lead } from "@/lib/leadData";
import { AdminShell } from "../AdminShell";
import { AdminLeadsPanel } from "./AdminLeadsPanel";
import styles from "./AdminLessonsManager.module.css";

// Enrollment inquiries submitted from the public site's "Find your batch"
// form (see components/EnrollModal.tsx), persisted in Supabase (see
// app/api/leads) — visible here even if the visitor never pays.
export function AdminLeadsPage() {
  const { items: leads, loaded, remove } = useAdminCollection<Lead>("/api/leads");

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Enrollments.</h1>
        <p>Everyone who filled the batch enroll form on the website, newest first.</p>
      </div>

      {!loaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : (
        <div className={styles.tabPanel}>
          <AdminLeadsPanel leads={leads} onRemove={remove} />
        </div>
      )}
    </AdminShell>
  );
}
