"use client";

import type { Lead } from "@/lib/leadData";
import styles from "./AdminLeadsPanel.module.css";

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

// Enrollment inquiries submitted from the public site's batch-picker form
// (see components/EnrollModal.tsx) — every visitor who filled the form and
// continued to WhatsApp, newest first.
export function AdminLeadsPanel({ leads, onRemove }: { leads: Lead[]; onRemove: (id: string) => void }) {
  if (leads.length === 0) {
    return <div className={styles.empty}>No enrollment inquiries yet.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Course &amp; batch</th>
            <th>Level</th>
            <th>Notes</th>
            <th>Submitted</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>{lead.name}</td>
              <td className={styles.contact}>
                <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                <a href={`mailto:${lead.email}`}>{lead.email}</a>
              </td>
              <td>
                <span className={styles.course}>{lead.course}</span>
                <div>{lead.batchName}</div>
              </td>
              <td>{lead.currentLevel || <span className={styles.muted}>—</span>}</td>
              <td className={styles.notes}>{lead.notes || <span className={styles.muted}>—</span>}</td>
              <td className={styles.time}>{formatWhen(lead.createdAt)}</td>
              <td>
                <button type="button" className={styles.remove} onClick={() => onRemove(lead.id)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
