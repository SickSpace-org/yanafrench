"use client";

import { useEffect, type ReactNode } from "react";
import type { TeacherBatch } from "@/lib/teacherData";
import own from "./admin/AdminAttendancePage.module.css";
import styles from "./TeacherPortal.module.css";

// Batch selector for the teacher-portal pages that work on one batch at a
// time. Picks the first batch automatically; shows the "no batches" note
// when the teacher has none.
export function TeacherBatchPicker({
  batches,
  value,
  onChange,
  children,
}: {
  batches: TeacherBatch[];
  value: string;
  onChange: (id: string) => void;
  children?: ReactNode;
}) {
  useEffect(() => {
    if (batches.length > 0 && !batches.some((b) => b.id === value)) onChange(batches[0].id);
  }, [batches, value, onChange]);

  if (batches.length === 0) {
    return <div className={styles.empty}>No batches assigned to you yet — Yana will assign you one.</div>;
  }
  return (
    <div className={own.controls}>
      <label>
        <span>Batch</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.course} · {b.name}</option>
          ))}
        </select>
      </label>
      {children}
    </div>
  );
}
