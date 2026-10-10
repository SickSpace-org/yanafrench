"use client";

import { useEffect, useState } from "react";
import type { RosterStudent } from "@/lib/teacherData";
import { useTeacherMe } from "@/lib/useTeacherMe";
import { AnnouncementsPanel } from "./AnnouncementsPanel";
import { TeacherBatchPicker } from "./TeacherBatchPicker";
import styles from "./TeacherPortal.module.css";

// Teacher -> Announcements: one-way notes to a whole batch or one student
// in it. Students see them in their Notifications.
export function TeacherAnnouncementsPage() {
  const { me, failed } = useTeacherMe();
  const [batchId, setBatchId] = useState("");
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    setRoster(null);
    fetch(`/api/teacher/batches/${encodeURIComponent(batchId)}/students`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { students: [] }))
      .then((data: { students: RosterStudent[] }) => !cancelled && setRoster(data.students))
      .catch(() => !cancelled && setRoster([]));
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  if (failed) return <div className={styles.empty}>Couldn&rsquo;t load your batches. Refresh the page to try again.</div>;
  if (!me) return <p className={styles.meta}>Loading…</p>;

  return (
    <>
      <div className={styles.head}>
        <small>TEACHER</small>
        <h1>Announcements.</h1>
        <p>Send a note to a whole batch or one student in it. They see it in their Notifications. Announcements can&rsquo;t be edited after sending.</p>
      </div>
      <div className={styles.stack}>
        <TeacherBatchPicker batches={me.batches} value={batchId} onChange={setBatchId} />
        {batchId && <AnnouncementsPanel batchId={batchId} endpoint="/api/teacher/announcements" recipients={roster} />}
      </div>
    </>
  );
}
