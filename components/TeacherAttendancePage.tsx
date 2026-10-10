"use client";

import { useState } from "react";
import { formatSchedule } from "@/lib/batchData";
import { useTeacherMe } from "@/lib/useTeacherMe";
import { AttendanceIntro, AttendanceRegister, ClassLinkEditor } from "./AttendanceRegister";
import { TeacherBatchPicker } from "./TeacherBatchPicker";
import styles from "./TeacherPortal.module.css";

// Teacher -> Attendance: the same register and class-link editor as
// Admin -> Attendance, for the teacher's own batches only
// (app/api/teacher/attendance, app/api/teacher/class-links).
export function TeacherAttendancePage() {
  const { me, failed } = useTeacherMe();
  const [batchId, setBatchId] = useState("");

  if (failed) return <div className={styles.empty}>Couldn&rsquo;t load your batches. Refresh the page to try again.</div>;
  if (!me) return <p className={styles.meta}>Loading…</p>;
  const batch = me.batches.find((b) => b.id === batchId);

  return (
    <>
      <div className={styles.head}>
        <small>TEACHER</small>
        <h1>Attendance.</h1>
        <p>
          <AttendanceIntro />
        </p>
      </div>

      <div className={styles.stack}>
        <TeacherBatchPicker batches={me.batches} value={batchId} onChange={setBatchId} />
        {batch && (
          <>
            <ClassLinkEditor batchId={batch.id} endpoint="/api/teacher/class-links" />
            <p className={styles.meta}>
              {formatSchedule(batch)} · last 30 days · India time
            </p>
            <AttendanceRegister batchId={batch.id} endpoint="/api/teacher/attendance" />
          </>
        )}
      </div>
    </>
  );
}
