"use client";

import { useEffect, useState } from "react";
import { usePortalState } from "@/lib/usePortalState";
import { useBatchTeacherNames } from "@/lib/useBatchTeacherNames";
import { formatSchedule } from "@/lib/batchData";
import { AttendanceIntro, AttendanceRegister, ClassLinkEditor } from "../AttendanceRegister";
import { AdminShell } from "../AdminShell";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import own from "./AdminAttendancePage.module.css";

// Admin -> Attendance: pick a batch, set its class link, and read/correct
// its register. The register and link editor are shared with the teacher
// portal (components/AttendanceRegister.tsx); the admin side can reach
// every batch and also sees students' emails.
export function AdminAttendancePage() {
  const { loaded, batches } = usePortalState();
  const { loaded: teachersLoaded, teacherFor } = useBatchTeacherNames();
  const [batchId, setBatchId] = useState("");

  useEffect(() => {
    if (!batchId && batches.length > 0) setBatchId(batches[0].id);
  }, [batches, batchId]);

  const batch = batches.find((b) => b.id === batchId);

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Attendance.</h1>
        <p>
          <AttendanceIntro />
        </p>
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

          {batchId && <ClassLinkEditor batchId={batchId} endpoint="/api/class-links" />}

          {batch && (
            <p className={styles.tabHint}>
              {formatSchedule(batch)} · last 30 days
              {teachersLoaded && <> · Teacher: {teacherFor(batch.id)}</>}
            </p>
          )}

          {batchId && <AttendanceRegister batchId={batchId} endpoint="/api/attendance" />}
        </div>
      )}
    </AdminShell>
  );
}
