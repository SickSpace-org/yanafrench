"use client";

import { useState } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import type { EnrollmentRequest } from "@/lib/enrollmentRequestData";
import { AdminShell } from "../AdminShell";
import { AdminLeadsPanel } from "./AdminLeadsPanel";
import panelStyles from "./AdminLeadsPanel.module.css";
import styles from "./AdminLessonsManager.module.css";

// Enroll forms submitted on the public site — batch (EnrollModal) and
// course (CourseEnrollModal) — waiting for the admin to confirm payment
// (see app/api/enrollment-requests). Confirming moves them to Payments.
export function AdminLeadsPage() {
  const { items: requests, loaded, remove, refresh } = useAdminCollection<EnrollmentRequest>("/api/enrollment-requests");
  const [moved, setMoved] = useState<string | null>(null);

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Enrollments.</h1>
        <p>
          Everyone who filled an enroll form on the website, newest first. Once you&rsquo;ve received their payment, press
          &ldquo;Payment received&rdquo; — they move to Payments and Students (and EMI, if they&rsquo;re paying in installments).
        </p>
      </div>

      {!loaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : (
        <div className={styles.tabPanel}>
          {moved && <p className={panelStyles.banner}>{moved}</p>}
          <AdminLeadsPanel
            requests={requests}
            onRemove={remove}
            onConfirmed={(r) => {
              setMoved(
                `Payment confirmed — ${r.name} is now enrolled in ${r.kind === "batch" ? `${r.title} · ${r.detail}` : r.title} and has been emailed their login.`
              );
              refresh();
            }}
          />
        </div>
      )}
    </AdminShell>
  );
}
