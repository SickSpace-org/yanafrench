"use client";

import type { Student } from "@/lib/studentData";
import styles from "./AdminLeadsPanel.module.css";

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

// The roster of confirmed, paying students — one row per successfully
// verified payment (see app/api/payment/verify), created automatically the
// moment someone pays. Distinct from Enrollments (every inquiry) and
// Payments (every transaction attempt, paid or not).
export function AdminStudentsPanel({ students, onRemove }: { students: Student[]; onRemove: (id: string) => void }) {
  if (students.length === 0) {
    return <div className={styles.empty}>No paying students yet.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Course &amp; batch</th>
            <th>Enrolled</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td className={styles.contact}>
                <a href={`tel:${s.phone}`}>{s.phone}</a>
                <a href={`mailto:${s.email}`}>{s.email}</a>
              </td>
              <td>
                <span className={styles.course}>{s.course}</span>
                <div>{s.batchName}</div>
              </td>
              <td className={styles.time}>{formatWhen(s.enrolledAt)}</td>
              <td>
                <button type="button" className={styles.remove} onClick={() => onRemove(s.id)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
