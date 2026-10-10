"use client";

import { usePortalState } from "@/lib/usePortalState";
import { useBatchTeacherNames } from "@/lib/useBatchTeacherNames";
import { AdminShell } from "../AdminShell";
import { AdminBatchesPanel } from "./AdminBatchesPanel";
import styles from "./AdminLessonsManager.module.css";

// Its own top-level admin page (not a Lessons tab) — class batches feed
// both the public Available Batches section and, via whichever batch is
// flagged isCurrent, the student's calendar (see lib/batchData.ts).
export function AdminBatchesPage() {
  const { loaded, batches, addBatch, removeBatch, updateBatch, setCurrentBatch } = usePortalState();
  const { loaded: teachersLoaded, teacherFor } = useBatchTeacherNames();

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Batches.</h1>
        <p>Manage class batches — every published batch shows live on the website&rsquo;s Available Batches section and the student&rsquo;s calendar. Marking one as her main batch just highlights it there.</p>
      </div>

      {!loaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : (
        <div className={styles.tabPanel}>
          <AdminBatchesPanel batches={batches} teacherFor={teachersLoaded ? teacherFor : undefined} onAdd={addBatch} onUpdate={updateBatch} onRemove={removeBatch} onSetCurrent={setCurrentBatch} />
        </div>
      )}
    </AdminShell>
  );
}
