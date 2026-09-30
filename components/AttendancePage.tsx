"use client";

import { useEffect, useState } from "react";
import { formatIndiaDate } from "@/lib/emiData";
import { JOIN_EARLY_MINUTES, JOIN_WINDOW_MINUTES, type SessionStatus } from "@/lib/attendanceData";
import { DashboardShell } from "./DashboardShell";
import styles from "./AttendancePage.module.css";

type Session = { batchId: string; batchName: string; course: string; date: string; status: SessionStatus; source: "auto" | "manual" | null };

const LABELS: Record<SessionStatus, string> = { present: "Present", absent: "Absent", open: "Join now", upcoming: "Upcoming" };

// The student's own class attendance. Present is recorded automatically
// when they click "Join class" from 5 minutes before a class until 15
// minutes after it starts;
// the teacher can also mark it by hand.
export function AttendancePage() {
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    fetch("/api/student/attendance", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setSessions(data.sessions ?? []))
      .catch(() => setSessions([]));
  }, []);

  const decided = (sessions ?? []).filter((s) => s.status === "present" || s.status === "absent");
  const present = decided.filter((s) => s.status === "present").length;
  const percent = decided.length ? Math.round((present / decided.length) * 100) : null;

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>YOUR CLASSES</small>
        <h1>Attendance.</h1>
        <p>You&rsquo;re marked present automatically when you click <strong>Join class</strong> from {JOIN_EARLY_MINUTES} minutes before a class until {JOIN_WINDOW_MINUTES} minutes after it starts.</p>
      </div>

      {sessions === null ? (
        <p className={styles.muted}>Loading…</p>
      ) : sessions.length === 0 ? (
        <p className={styles.muted}>No classes yet — your attendance will appear here once your batch starts.</p>
      ) : (
        <>
          <div className={styles.stats}>
            <div><span>Attendance</span><strong>{percent === null ? "—" : `${percent}%`}</strong></div>
            <div><span>Present</span><strong>{present}</strong></div>
            <div><span>Absent</span><strong>{decided.length - present}</strong></div>
          </div>
          <ul className={styles.list}>
            {sessions.map((s) => (
              <li key={`${s.batchId}-${s.date}`} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong>{formatIndiaDate(s.date)}</strong>
                  <span>{s.course} · {s.batchName}</span>
                </div>
                <span className={`${styles.chip} ${styles[`chip_${s.status}`]}`}>
                  {LABELS[s.status]}
                  {s.source === "manual" ? " · by teacher" : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardShell>
  );
}
