"use client";

import { useCallback, useEffect, useState } from "react";
import { usePortalState } from "@/lib/usePortalState";
import { formatDays, formatTime } from "@/lib/batchData";
import { formatIndiaDate } from "@/lib/emiData";
import { JOIN_WINDOW_MINUTES, type AttendanceStatus, type SessionStatus } from "@/lib/attendanceData";
import { AdminShell } from "../AdminShell";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import own from "./AdminAttendancePage.module.css";

type Row = { studentId: string; name: string; email: string; status: SessionStatus; source: "auto" | "manual" | null; markedAt: string | null };

const POLL_MS = 5000;
const LABELS: Record<SessionStatus, string> = { present: "Present", absent: "Absent", open: "Window open", upcoming: "Upcoming" };

function formatClock(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

// Pick a batch and a class date to see every enrolled student's attendance
// — updated live as students click "Join class" — and override any of
// them by hand. A manual mark always wins over the automatic one.
export function AdminAttendancePage() {
  const { loaded, batches } = usePortalState();
  const [batchId, setBatchId] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Default to the first batch once batches load.
  useEffect(() => {
    if (!batchId && batches.length > 0) setBatchId(batches[0].id);
  }, [batches, batchId]);

  // A batch's class dates; default to today's class, else the latest past one.
  useEffect(() => {
    if (!batchId) return;
    setDates([]);
    setDate("");
    setRows(null);
    fetch(`/api/attendance?batchId=${encodeURIComponent(batchId)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { today: string; dates: string[] }) => {
        setToday(data.today);
        setDates(data.dates);
        setDate(data.dates.find((d) => d <= data.today) ?? data.dates[data.dates.length - 1] ?? "");
      })
      .catch(() => setDates([]));
  }, [batchId]);

  const loadRows = useCallback(async () => {
    if (!batchId || !date) return;
    try {
      const res = await fetch(`/api/attendance?batchId=${encodeURIComponent(batchId)}&date=${date}`, { cache: "no-store" });
      if (res.ok) setRows((await res.json()).students);
    } catch {
      // keep last-known rows if a poll fails
    }
  }, [batchId, date]);

  useEffect(() => {
    setRows(null);
    loadRows();
    const timer = setInterval(loadRows, POLL_MS);
    return () => clearInterval(timer);
  }, [loadRows]);

  async function mark(studentId: string, status: AttendanceStatus) {
    setSavingId(studentId);
    setRows((prev) => prev?.map((r) => (r.studentId === studentId ? { ...r, status, source: "manual", markedAt: new Date().toISOString() } : r)) ?? prev);
    try {
      await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, batchId, date, status }),
      });
    } finally {
      setSavingId(null);
      loadRows();
    }
  }

  const batch = batches.find((b) => b.id === batchId);
  const present = rows?.filter((r) => r.status === "present").length ?? 0;
  const absent = rows?.filter((r) => r.status === "absent").length ?? 0;

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Attendance.</h1>
        <p>Students are marked present automatically when they click Join class within {JOIN_WINDOW_MINUTES} minutes of the class start, absent otherwise. Override anyone by hand — a manual mark always wins.</p>
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
            <label>
              <span>Class</span>
              <select value={date} onChange={(e) => setDate(e.target.value)} disabled={dates.length === 0}>
                {dates.length === 0 && <option value="">No classes scheduled</option>}
                {dates.map((d) => (
                  <option key={d} value={d}>{formatIndiaDate(d)}{d === today ? " (today)" : d > today ? " (upcoming)" : ""}</option>
                ))}
              </select>
            </label>
          </div>

          {batch && (
            <p className={styles.tabHint}>
              {formatDays(batch.days)} · {formatTime(batch.start_time)}–{formatTime(batch.end_time)} · auto-present window {formatTime(batch.start_time)} + {JOIN_WINDOW_MINUTES} min
            </p>
          )}

          {date && rows && (
            <p className={own.summary}>
              <strong>{present}</strong> present · <strong>{absent}</strong> absent · {rows.length} enrolled
            </p>
          )}

          {!date ? null : rows === null ? (
            <p className={styles.tabHint}>Loading…</p>
          ) : rows.length === 0 ? (
            <div className={leadStyles.empty}>No students were enrolled in this batch on this date.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className={leadStyles.table}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.studentId}>
                      <td>
                        {r.name}
                        <div className={leadStyles.muted}>{r.email}</div>
                      </td>
                      <td>
                        <span className={`${own.chip} ${own[`chip_${r.status}`]}`}>{LABELS[r.status]}</span>
                        {r.markedAt && (
                          <div className={leadStyles.muted}>
                            {r.source === "manual" ? "Marked by admin" : "Joined"} at {formatClock(r.markedAt)}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={own.markButtons}>
                          <button
                            type="button"
                            className={r.status === "present" ? own.markPresentActive : own.markButton}
                            disabled={savingId === r.studentId}
                            onClick={() => mark(r.studentId, "present")}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            className={r.status === "absent" ? own.markAbsentActive : own.markButton}
                            disabled={savingId === r.studentId}
                            onClick={() => mark(r.studentId, "absent")}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
