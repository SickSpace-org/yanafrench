"use client";

import { useCallback, useEffect, useState } from "react";
import { JOIN_EARLY_MINUTES, JOIN_WINDOW_MINUTES, type AttendanceStatus } from "@/lib/attendanceData";
import type { Register, RegisterCell } from "@/lib/attendance";
import leadStyles from "./admin/AdminLeadsPanel.module.css";
import own from "./admin/AdminAttendancePage.module.css";

// The attendance register and class-link editor, shared by Admin ->
// Attendance and the teacher portal. Both sides use the same UI against
// their own API routes: /api/attendance + /api/class-links for the admin,
// /api/teacher/attendance + /api/teacher/class-links for a teacher.

export type AttendanceApi = { register: string; classLinks: string };

const POLL_MS = 5000;

function columnLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    weekday: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(dt),
    day: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(dt),
  };
}

function formatClock(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

function cellTitle(name: string, date: string, cell: RegisterCell) {
  if (!cell) return `${name} wasn't enrolled yet on ${date}`;
  const how = cell.markedAt
    ? cell.source === "manual"
      ? ` — marked by ${cell.markedBy ?? "hand"} at ${formatClock(cell.markedAt)}`
      : ` — joined at ${formatClock(cell.markedAt)}`
    : "";
  const what = { present: "Present", absent: "Absent", open: "Join window open, not joined yet", upcoming: "Class not started yet" }[cell.status];
  return `${name} · ${date}: ${what}${how}. Click to mark ${cell.status === "present" ? "absent" : "present"}.`;
}

// The selected batch's class link (Zoom / Meet / …) — only students in
// this batch see it, on their dashboard and behind "Join class".
export function ClassLinkEditor({ batchId, endpoint }: { batchId: string; endpoint: string }) {
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSaved(undefined);
    setMessage(null);
    fetch(`${endpoint}?batchId=${encodeURIComponent(batchId)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { url: null }))
      .then((data) => {
        if (cancelled) return;
        setSaved(data.url ?? null);
        setValue(data.url ?? "");
      })
      .catch(() => !cancelled && setSaved(null));
    return () => {
      cancelled = true;
    };
  }, [batchId, endpoint]);

  async function save(url: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, url }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Couldn't save the link.");
      const data = (await res.json()) as { url: string | null };
      setSaved(data.url);
      setValue(data.url ?? "");
      setMessage({ ok: true, text: data.url ? "Saved — students in this batch can see it now." : "Link removed." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Couldn't save the link." });
    } finally {
      setSaving(false);
    }
  }

  const dirty = saved !== undefined && value.trim() !== (saved ?? "");

  return (
    <div className={own.linkBox}>
      <label>
        <span>Class link for this batch</span>
        <input
          type="url"
          inputMode="url"
          placeholder={saved === undefined ? "Loading…" : "Paste the Zoom / Google Meet link"}
          value={value}
          disabled={saved === undefined || saving}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && dirty && save(value)}
        />
      </label>
      <button type="button" className={own.linkSave} disabled={!dirty || saving} onClick={() => save(value)}>
        {saving ? "Saving…" : "Save link"}
      </button>
      {saved && !dirty && (
        <button type="button" className={own.linkRemove} disabled={saving} onClick={() => save("")}>
          Remove
        </button>
      )}
      <p className={message ? (message.ok ? own.linkOk : own.linkError) : own.linkHint}>
        {message?.text ??
          (saved
            ? "Students in this batch see this link on their dashboard, and Join class opens it."
            : "No link yet — students in this batch see \"Link coming soon\" until you add one.")}
      </p>
    </div>
  );
}

export function AttendanceIntro() {
  return (
    <>
      Students are marked <strong>P</strong> automatically when they click Join class from {JOIN_EARLY_MINUTES} minutes before a class until{" "}
      {JOIN_WINDOW_MINUTES} minutes after it starts, <strong>A</strong> otherwise. Click any cell to switch it between P and A.
    </>
  );
}

// Register for one batch: students down the side, class dates across the
// top (today first), P / A in each cell — updated live as students click
// "Join class". Click any cell to flip it between P and A.
export function AttendanceRegister({ batchId, endpoint }: { batchId: string; endpoint: string }) {
  const [register, setRegister] = useState<Register | null>(null);
  const [failed, setFailed] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await fetch(`${endpoint}?batchId=${encodeURIComponent(batchId)}`, { cache: "no-store" });
      if (res.ok) {
        setRegister(await res.json());
        setFailed(false);
      } else setFailed(true);
    } catch {
      // keep last-known register if a poll fails
    }
  }, [batchId, endpoint]);

  useEffect(() => {
    setRegister(null);
    setFailed(false);
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function toggle(studentId: string, date: string, cell: RegisterCell) {
    if (!cell) return;
    const status: AttendanceStatus = cell.status === "present" ? "absent" : "present";
    const key = `${studentId}|${date}`;
    setSavingKey(key);
    setSaveError(null);
    setRegister((prev) =>
      prev && {
        ...prev,
        students: prev.students.map((s) =>
          s.studentId === studentId
            ? { ...s, cells: { ...s.cells, [date]: { status, source: "manual", markedAt: new Date().toISOString(), markedBy: "you" } } }
            : s
        ),
      }
    );
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, batchId, date, status }),
      });
      if (!res.ok) setSaveError((await res.text().catch(() => "")) || "Couldn't save that change.");
    } catch {
      setSaveError("Couldn't save that change.");
    } finally {
      setSavingKey(null);
      load();
    }
  }

  return (
    <>
      <div className={own.legend}>
        <span><i className={own.cellP}>P</i> Present</span>
        <span><i className={own.cellA}>A</i> Absent</span>
        <span><i className={own.cellOpen}>•</i> Class on now, not joined yet</span>
        <span><i className={own.cellUpcoming}>–</i> Not started</span>
        <span><i className={`${own.cellP} ${own.manual}`}>P</i> Marked by hand</span>
      </div>

      {saveError && <p className={leadStyles.confirmError}>{saveError}</p>}

      {failed && register === null ? (
        <div className={leadStyles.empty}>Couldn&rsquo;t load attendance for this batch.</div>
      ) : register === null ? (
        <p className={own.linkHint}>Loading…</p>
      ) : register.dates.length === 0 ? (
        <div className={leadStyles.empty}>No classes in the last 30 days for this batch.</div>
      ) : register.students.length === 0 ? (
        <div className={leadStyles.empty}>No students enrolled in this batch yet.</div>
      ) : (
        <div className={own.scroller}>
          <table className={own.register}>
            <thead>
              <tr>
                <th className={own.nameHead}>Student</th>
                <th className={own.pctHead}>%</th>
                {register.dates.map((d) => {
                  const { weekday, day } = columnLabel(d);
                  return (
                    <th key={d} className={d === register.today ? own.todayHead : undefined}>
                      <span>{d === register.today ? "Today" : weekday}</span>
                      {day}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {register.students.map((s) => {
                const decided = register.dates.map((d) => s.cells[d]).filter((c) => c && (c.status === "present" || c.status === "absent"));
                const present = decided.filter((c) => c!.status === "present").length;
                const pct = decided.length ? Math.round((present / decided.length) * 100) : null;
                return (
                  <tr key={s.studentId}>
                    <th scope="row" className={own.nameCell}>
                      {s.name}
                      {s.email && <small>{s.email}</small>}
                    </th>
                    <td className={own.pctCell}>{pct === null ? "—" : `${pct}%`}</td>
                    {register.dates.map((d) => {
                      const cell = s.cells[d];
                      if (!cell) return <td key={d} className={own.emptyCell} title={cellTitle(s.name, d, cell)} />;
                      const cls =
                        cell.status === "present" ? own.cellP : cell.status === "absent" ? own.cellA : cell.status === "open" ? own.cellOpen : own.cellUpcoming;
                      const label = cell.status === "present" ? "P" : cell.status === "absent" ? "A" : cell.status === "open" ? "•" : "–";
                      return (
                        <td key={d} className={d === register.today ? own.todayCell : undefined}>
                          <button
                            type="button"
                            className={`${cls} ${cell.source === "manual" ? own.manual : ""}`}
                            title={cellTitle(s.name, d, cell)}
                            disabled={savingKey === `${s.studentId}|${d}`}
                            onClick={() => toggle(s.studentId, d, cell)}
                          >
                            {label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
