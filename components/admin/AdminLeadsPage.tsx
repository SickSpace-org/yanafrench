"use client";

import { usePortalState } from "@/lib/usePortalState";
import { AdminShell } from "../AdminShell";
import { AdminLeadsPanel } from "./AdminLeadsPanel";
import styles from "./AdminLessonsManager.module.css";

// Enrollment inquiries submitted from the public site's "Find your batch"
// form (see components/EnrollModal.tsx) before the visitor is handed off to
// WhatsApp — visible here even if they never actually message.
export function AdminLeadsPage() {
  const { loaded, leads, removeLead } = usePortalState();

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
          <AdminLeadsPanel leads={leads} onRemove={removeLead} />
        </div>
      )}
    </AdminShell>
  );
}
