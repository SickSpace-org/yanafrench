"use client";

import { useState } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import type { Student } from "@/lib/studentData";
import { AdminShell } from "../AdminShell";
import { AdminStudentsPanel } from "./AdminStudentsPanel";
import styles from "./AdminLessonsManager.module.css";

// The roster of confirmed, paying students, persisted in Supabase (see
// app/api/students) — created automatically the moment a Razorpay payment
// is verified (see app/api/payment/verify).
export function AdminStudentsPage() {
  const { items: students, loaded, remove, refresh } = useAdminCollection<Student>("/api/students");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  // Removes a single enrollment (batch or course-catalog), not the
  // student's whole identity/login — see app/api/batch-enrollments/[id]
  // and app/api/course-enrollments/[id]. useAdminCollection's own `remove`
  // only knows how to delete a top-level /api/students row, so this is a
  // separate one-off call followed by a manual refresh.
  async function removeEnrollment(kind: "batch" | "course", enrollmentId: string) {
    const endpoint = kind === "batch" ? "/api/batch-enrollments" : "/api/course-enrollments";
    await fetch(`${endpoint}/${enrollmentId}`, { method: "DELETE" }).catch(() => {});
    refresh();
  }

  // Also how the 3 pre-existing students (created before student accounts
  // existed) get linked — one deliberate click each, never automatic.
  async function resendSetupLink(id: string) {
    setSendingId(id);
    setSentId(null);
    setFailedId(null);
    try {
      const res = await fetch(`/api/students/${id}/resend-setup`, { method: "POST" });
      const data = res.ok ? await res.json().catch(() => null) : null;
      if (data?.emailSent) setSentId(id);
      else setFailedId(id);
    } catch {
      setFailedId(id);
    } finally {
      setSendingId((current) => (current === id ? null : current));
    }
  }

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
          <AdminStudentsPanel
            students={students}
            onRemove={remove}
            onRemoveEnrollment={removeEnrollment}
            onResendSetupLink={resendSetupLink}
            sendingId={sendingId}
            sentId={sentId}
            failedId={failedId}
          />
        </div>
      )}
    </AdminShell>
  );
}
