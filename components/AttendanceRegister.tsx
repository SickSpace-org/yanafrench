"use client";

import { useCallback, useEffect, useState } from "react";
import { JOIN_EARLY_MINUTES, JOIN_WINDOW_MINUTES, type AttendanceStatus } from "@/lib/attendanceData";
import type { Register, RegisterCell } from "@/lib/attendance";
import leadStyles from "./admin/AdminLeadsPanel.module.css";
import own from "./admin/AdminAttendancePage.module.css";

// The attendance register and class-link editor, shared by Admin ->
// Attendance and the teacher portal. Both sides use the same UI against
// their own API routes: /api/attendance + /api/class-links for the admin,
// /api/teacher/attendance + /api/teacher/class-links for a teacher (and
// each register endpoint's /cancellations for "Cancel a class").

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

function shortDate(date: string) {
  const { weekday, day } = columnLabel(date);
  return `${weekday} ${day}`;
}

function formatClock(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

function cellTitle(name: string, date: string, cell: RegisterCell) {
  if (!cell) return `${name} wasn't enrolled yet on ${date}`;
  if (cell.status === "cancelled") return `${name} · ${date}: Class cancelled — not counted in attendance.`;
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
      {JOIN_WINDOW_MINUTES} minutes after it starts, <strong>A</strong> otherwise. Click any cell to switch it between P and A. If a class
      isn&rsquo;t happening, use <strong>Cancel a class</strong>: the batch&rsquo;s students are emailed and see it as cancelled in their
      Student Hub, and it isn&rsquo;t counted in attendance.
    </>
  );
}

// "Cancel a class" for the selected batch: pick a class (today and the
// next 30 days first, then past ones still on the register), add an
// optional note for the students, confirm. For a class today or later,
// everyone in the batch is emailed (lib/classCancellations.ts); a past
// class is just marked. Cancelled classes are listed with Restore, which
// emails "back on" for a class still ahead.
function ClassCancelPanel({ register, batchId, endpoint, onChange }: { register: Register; batchId: string; endpoint: string; onChange: () => void }) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState<{ action: "cancel" | "restore"; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setDate("");
    setNote("");
    setConfirming(null);
    setMessage(null);
  }, [batchId]);

  const ahead = [...(register.dates.includes(register.today) ? [register.today] : []), ...register.upcoming];
  const past = register.dates.filter((d) => d !== register.today);
  const choices = [...ahead, ...past].filter((d) => !register.cancelled[d]);
  const selected = choices.includes(date) ? date : choices[0] ?? "";
  const cancelledDates = Object.keys(register.cancelled).sort();
  const willEmail = (d: string) => d >= register.today;
  const students = (n: number) => `${n} student${n === 1 ? "" : "s"}`;
  const dateLabel = (d: string) => `${d === register.today ? "Today · " : ""}${shortDate(d)}`;

  async function submit(action: "cancel" | "restore", d: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${endpoint}/cancellations`, {
        method: action === "cancel" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, date: d, ...(action === "cancel" ? { note } : {}) }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Something went wrong.");
      const { emailed } = (await res.json()) as { emailed: number };
      setMessage({
        ok: true,
        text:
          action === "cancel"
            ? `${dateLabel(d)} class cancelled${emailed ? ` — emailing ${students(emailed)}.` : "."}`
            : `${dateLabel(d)} class restored${emailed ? ` — emailing ${students(emailed)} that it's back on.` : "."}`,
      });
      if (action === "cancel") setNote("");
      setConfirming(null);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
      onChange();
    }
  }

  return (
    <div className={own.cancelBox}>
      <div className={own.cancelForm}>
        <label>
          <span>Cancel a class</span>
          <select
            value={selected}
            disabled={busy || choices.length === 0}
            onChange={(e) => {
              setDate(e.target.value);
              setConfirming(null);
            }}
          >
            {choices.length === 0 && <option value="">No classes to cancel</option>}
            {choices.map((d) => (
              <option key={d} value={d}>
                {dateLabel(d)}
                {d < register.today ? " (past)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={own.cancelNote}>
          <span>Note for students (optional)</span>
          <input
            type="text"
            maxLength={300}
            placeholder="e.g. Teacher unwell, we'll make it up on Saturday"
            value={note}
            disabled={busy || !selected}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {confirming?.action === "cancel" && confirming.date === selected ? (
          <>
            <button type="button" className={own.cancelConfirm} disabled={busy} onClick={() => submit("cancel", selected)}>
              {busy ? "Cancelling…" : willEmail(selected) ? `Yes, cancel & email ${students(register.students.length)}` : "Yes, mark cancelled"}
            </button>
            <button type="button" className={own.linkRemove} disabled={busy} onClick={() => setConfirming(null)}>
              Back
            </button>
          </>
        ) : (
          <button
            type="button"
            className={own.cancelBtn}
            disabled={busy || !selected}
            onClick={() => {
              setConfirming({ action: "cancel", date: selected });
              setMessage(null);
            }}
          >
            Cancel class
          </button>
        )}
      </div>
      <p className={message ? (message.ok ? own.linkOk : own.linkError) : own.linkHint}>
        {message?.text ??
          (!selected
            ? "No classes in the next 30 days to cancel."
            : willEmail(selected)
              ? "Everyone in this batch gets an email, and the class shows as cancelled in their Student Hub. It isn't counted in attendance."
              : "A past class is only marked cancelled (no email) and left out of attendance.")}
      </p>
      {cancelledDates.length > 0 && (
        <ul className={own.cancelList}>
          {cancelledDates.map((d) => {
            const c = register.cancelled[d];
            return (
              <li key={d}>
                <strong>{dateLabel(d)}</strong>
                <span>
                  Cancelled{c.by ? ` by ${c.by}` : ""}
                  {c.note ? `: "${c.note}"` : ""}
                </span>
                {confirming?.action === "restore" && confirming.date === d ? (
                  <>
                    <button type="button" className={own.restoreConfirm} disabled={busy} onClick={() => submit("restore", d)}>
                      {busy ? "Restoring…" : willEmail(d) ? `Restore & email ${students(register.students.length)}` : "Yes, restore"}
                    </button>
                    <button type="button" className={own.restoreBtn} disabled={busy} onClick={() => setConfirming(null)}>
                      Back
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={own.restoreBtn}
                    disabled={busy}
                    onClick={() => {
                      setConfirming({ action: "restore", date: d });
                      setMessage(null);
                    }}
                  >
                    Restore
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
      {register && <ClassCancelPanel register={register} batchId={batchId} endpoint={endpoint} onChange={load} />}

      <div className={own.legend}>
        <span><i className={own.cellP}>P</i> Present</span>
        <span><i className={own.cellA}>A</i> Absent</span>
        <span><i className={own.cellOpen}>•</i> Class on now, not joined yet</span>
        <span><i className={own.cellUpcoming}>–</i> Not started</span>
        <span><i className={own.cellC}>C</i> Class cancelled</span>
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
                  const cancelled = register.cancelled[d];
                  return (
                    <th
                      key={d}
                      className={cancelled ? own.cancelHead : d === register.today ? own.todayHead : undefined}
                      title={cancelled ? `Class cancelled${cancelled.note ? `: ${cancelled.note}` : ""}` : undefined}
                    >
                      <span>{cancelled ? "Cancelled" : d === register.today ? "Today" : weekday}</span>
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
                      if (cell.status === "cancelled")
                        return (
                          <td key={d} className={own.cancelledCell}>
                            <span className={own.cellC} title={cellTitle(s.name, d, cell)}>C</span>
                          </td>
                        );
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
