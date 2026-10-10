"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortalState } from "@/lib/usePortalState";
import { useAdminCollection } from "@/lib/useAdminCollection";
import { useBatchTeacherNames } from "@/lib/useBatchTeacherNames";
import type { Student } from "@/lib/studentData";
import { AnnouncementsPanel } from "../AnnouncementsPanel";
import { AdminShell } from "../AdminShell";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import own from "./AdminAttendancePage.module.css";

// Admin -> Announcements: send a note from Yana to any batch (or one student
// in it), and see — or delete — everything sent there, teachers' included.
// The one-to-one Messages thread is separate and unchanged.
export function AdminAnnouncementsPage() {
  const { loaded, batches } = usePortalState();
  const { items: students } = useAdminCollection<Student>("/api/students");
  const { loaded: teachersLoaded, teacherFor } = useBatchTeacherNames();
  const [batchId, setBatchId] = useState("");

  useEffect(() => {
    if (!batchId && batches.length > 0) setBatchId(batches[0].id);
  }, [batches, batchId]);

  const recipients = useMemo(
    () =>
      students
        .filter((s) => s.batchEnrollments.some((e) => e.batchId === batchId && e.status === "active"))
        .map((s) => ({ id: s.id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [students, batchId]
  );

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Announcements.</h1>
        <p>Send a note to a whole batch or one student in it — it appears in their Notifications. Teachers&rsquo; announcements show here too, and you can delete any of them.</p>
      </div>

      {!loaded ? (
        <p className={styles.tabHint}>Loading…</p>
      ) : batches.length === 0 ? (
        <div className={leadStyles.empty}>No batches yet — create one in Admin → Batches.</div>
      ) : (
        <div className={styles.tabPanel}>
          <div className={own.controls}>
            <label>
              <span>Batch</span>
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.course} · {b.name}</option>
                ))}
              </select>
            </label>
          </div>
          {teachersLoaded && batchId && <p className={styles.tabHint}>Teacher: {teacherFor(batchId)}</p>}
          {batchId && <AnnouncementsPanel batchId={batchId} endpoint="/api/announcements" recipients={recipients} canDelete />}
        </div>
      )}
    </AdminShell>
  );
}
