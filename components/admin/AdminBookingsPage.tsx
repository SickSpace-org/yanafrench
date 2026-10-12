"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BOOKING_IS_PAID,
  BOOKING_KINDS,
  BOOKING_LABELS,
  DEFAULT_SLOT_CAPACITY,
  DEFAULT_TEACHER,
  TEACHERS,
  formatSlotDate,
  formatSlotTime,
  groupSlotsByDate,
  slotDateKey,
  type AdminSlot,
  type Booking,
  type BookingKind,
} from "@/lib/bookingData";
import { AdminShell } from "../AdminShell";
import lessonStyles from "./AdminLessonsManager.module.css";
import panelStyles from "./AdminLeadsPanel.module.css";
import styles from "./AdminBookingsPage.module.css";

const POLL_MS = 5000;

type View = "students" | "slots";
type PayFilter = "all" | "unpaid" | "paid";
type Row = Booking & { slot: AdminSlot };

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function istTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.ok ? null : (await res.text()) || "Something went wrong.";
  } catch {
    return "Something went wrong — check your connection.";
  }
}

function slotStatus(slot: AdminSlot): { label: string; className: string } {
  if (new Date(slot.startsAt).getTime() <= Date.now()) return { label: "Past", className: styles.statusPast };
  if (!slot.active) return { label: "Closed", className: styles.statusClosed };
  if (slot.booked >= slot.capacity) return { label: "Full", className: styles.statusFull };
  return { label: "Open", className: styles.statusOpen };
}

// Admin -> Bookings: Orientation Test and Demo Class bookings, each with its
// own slots and seat counts (see lib/bookingData.ts).
export function AdminBookingsPage() {
  const [kind, setKind] = useState<BookingKind>("orientation");
  const [view, setView] = useState<View>("students");
  const [slots, setSlots] = useState<AdminSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/booking-slots?kind=${kind}`, { cache: "no-store" });
      if (res.ok) setSlots(await res.json());
    } catch {
      // keep the last list if a poll fails
    }
  }, [kind]);

  useEffect(() => {
    setSlots(null);
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  async function act(url: string, method: string, body?: unknown) {
    setError(null);
    setNotice(null);
    const failure = await send(url, method, body);
    if (failure) setError(failure);
    await refresh();
    return !failure;
  }

  // Unpaid -> Paid also emails the student that their seat is confirmed.
  async function setPaid(row: Row, paid: boolean) {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/bookings/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Couldn't update the payment status.");
      const { emailed } = (await res.json()) as { emailed: boolean };
      if (paid) {
        setNotice(
          emailed
            ? `${row.name} is marked as paid and has been emailed that their payment is accepted and their seat is confirmed.`
            : `${row.name} is marked as paid, but the confirmation email couldn't be sent — please let them know on WhatsApp.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the payment status.");
    }
    await refresh();
  }

  const now = Date.now();
  const upcoming = (slots ?? []).filter((s) => new Date(s.startsAt).getTime() > now);
  const rows: Row[] = useMemo(
    () => (slots ?? []).flatMap((slot) => slot.bookings.map((b) => ({ ...b, slot }))),
    [slots]
  );
  const paid = BOOKING_IS_PAID[kind];
  const unpaidCount = rows.filter((r) => !r.paidAt).length;

  return (
    <AdminShell>
      <div className={lessonStyles.head}>
        <small>ADMIN</small>
        <h1>Bookings.</h1>
        <p>
          Orientation Test and Demo Class bookings from the website. Each has its own time slots — at most{" "}
          {DEFAULT_SLOT_CAPACITY} students per slot by default — and a slot closes to new bookings once it&rsquo;s full.
          All times are IST.
        </p>
      </div>

      <div className={lessonStyles.tabs} role="tablist">
        {BOOKING_KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? lessonStyles.tabActive : lessonStyles.tab} onClick={() => setKind(k)}>
            {BOOKING_LABELS[k]}
          </button>
        ))}
      </div>

      <div className={styles.stats}>
        <div><strong>{rows.length}</strong><span>{kind === "demo" ? "Demo students" : "Test bookings"}</span></div>
        <div><strong>{upcoming.filter((s) => s.active && s.booked < s.capacity).length}</strong><span>Upcoming open slots</span></div>
        <div><strong>{upcoming.filter((s) => s.active).reduce((n, s) => n + Math.max(s.capacity - s.booked, 0), 0)}</strong><span>Seats left</span></div>
        {paid ? (
          <div><strong>{unpaidCount}</strong><span>Unpaid</span></div>
        ) : (
          <div><strong>Free</strong><span>No payment</span></div>
        )}
      </div>

      <div className={styles.viewSwitch} role="group" aria-label="View">
        <button type="button" className={view === "students" ? styles.viewActive : ""} aria-pressed={view === "students"} onClick={() => setView("students")}>
          Students
        </button>
        <button type="button" className={view === "slots" ? styles.viewActive : ""} aria-pressed={view === "slots"} onClick={() => setView("slots")}>
          Time slots
        </button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={panelStyles.banner} role="status">{notice}</p>}

      {slots === null ? (
        <p className={lessonStyles.tabHint}>Loading…</p>
      ) : view === "students" ? (
        <StudentsTable kind={kind} rows={rows} act={act} setPaid={setPaid} />
      ) : (
        <SlotsManager kind={kind} slots={slots} act={act} />
      )}
    </AdminShell>
  );
}

type Act = (url: string, method: string, body?: unknown) => Promise<boolean>;

function StudentsTable({ kind, rows, act, setPaid }: { kind: BookingKind; rows: Row[]; act: Act; setPaid: (row: Row, paid: boolean) => Promise<void> }) {
  const paid = BOOKING_IS_PAID[kind];
  const [filter, setFilter] = useState<PayFilter>("all");
  const [teacher, setTeacher] = useState<string>("all");
  const [showPast, setShowPast] = useState(false);
  const now = Date.now();

  const visible = rows
    .filter((r) => showPast || new Date(r.slot.startsAt).getTime() > now)
    .filter((r) => teacher === "all" || r.teacher === teacher)
    .filter((r) => !paid || filter === "all" || (filter === "paid" ? !!r.paidAt : !r.paidAt))
    .sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt) || a.createdAt.localeCompare(b.createdAt));
  const pastCount = rows.filter((r) => new Date(r.slot.startsAt).getTime() <= now).length;

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        {paid && (
          <div className={styles.filters} role="group" aria-label="Payment">
            {(["all", "unpaid", "paid"] as PayFilter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? styles.filterActive : styles.filter} onClick={() => setFilter(f)}>
                {f === "all" ? `All (${rows.length})` : f === "paid" ? `Paid (${rows.filter((r) => r.paidAt).length})` : `Unpaid (${rows.filter((r) => !r.paidAt).length})`}
              </button>
            ))}
          </div>
        )}
        <div className={styles.filters} role="group" aria-label="Teacher">
          {["all", ...TEACHERS].map((t) => (
            <button key={t} type="button" aria-pressed={teacher === t} className={teacher === t ? styles.filterActive : styles.filter} onClick={() => setTeacher(t)}>
              {t === "all" ? "All teachers" : `${t} (${rows.filter((r) => r.teacher === t).length})`}
            </button>
          ))}
        </div>
        {pastCount > 0 && (
          <label className={styles.checkbox}>
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Show past slots ({pastCount})
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <div className={panelStyles.empty}>
          {rows.length === 0 ? `No ${BOOKING_LABELS[kind]} bookings yet — they'll appear here as students book.` : "Nobody matches this filter."}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={panelStyles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Date</th>
                <th>Time slot</th>
                <th>Teacher</th>
                <th>Level</th>
                <th>{paid ? "Payment" : "Fee"}</th>
                <th>Booked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                    {r.message && <div className={styles.message}>{r.message}</div>}
                  </td>
                  <td className={panelStyles.contact}>
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                    <a href={`tel:${r.phone}`}>{r.phone}</a>
                  </td>
                  <td className={styles.nowrap}>{formatSlotDate(r.slot.startsAt)}</td>
                  <td className={styles.nowrap}>
                    {formatSlotTime(r.slot.startsAt)} IST
                    <div className={styles.sub}>{r.slot.booked}/{r.slot.capacity} booked</div>
                  </td>
                  <td>
                    <select
                      className={styles.teacherSelect}
                      value={r.teacher}
                      aria-label={`Teacher for ${r.name}`}
                      onChange={(e) => act(`/api/bookings/${r.id}`, "PATCH", { teacher: e.target.value })}
                    >
                      {TEACHERS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {r.teacher !== r.slot.teacher && <div className={styles.sub}>Slot is {r.slot.teacher}&rsquo;s</div>}
                  </td>
                  <td>{r.level ?? <span className={panelStyles.muted}>—</span>}</td>
                  <td>
                    {paid ? (
                      <div className={styles.payCell}>
                        <span className={`${panelStyles.payment} ${r.paidAt ? panelStyles.payment_paid : panelStyles.payment_pending}`}>
                          {r.paidAt ? "Paid" : "Unpaid"}
                        </span>
                        <button type="button" className={panelStyles.action} onClick={() => {
                            if (r.paidAt ? window.confirm(`Mark ${r.name} as unpaid?`) : window.confirm(`Mark ${r.name} as paid? They'll be emailed that their payment is accepted and their seat is confirmed.`)) setPaid(r, !r.paidAt);
                          }}>
                          {r.paidAt ? "Mark unpaid" : "Mark paid"}
                        </button>
                      </div>
                    ) : (
                      <span className={`${panelStyles.payment} ${panelStyles.payment_paid}`}>Free</span>
                    )}
                  </td>
                  <td className={panelStyles.time}>{formatWhen(r.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={panelStyles.remove}
                      onClick={() => {
                        if (window.confirm(`Remove ${r.name}'s booking? Their seat will be freed for someone else.`)) act(`/api/bookings/${r.id}`, "DELETE");
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SlotsManager({ kind, slots, act }: { kind: BookingKind; slots: AdminSlot[]; act: Act }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [capacity, setCapacity] = useState(String(DEFAULT_SLOT_CAPACITY));
  const [teacher, setTeacher] = useState<string>(DEFAULT_TEACHER);
  const [adding, setAdding] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const now = Date.now();

  const visible = slots.filter((s) => showPast || new Date(s.startsAt).getTime() > now);
  const pastCount = slots.length - slots.filter((s) => new Date(s.startsAt).getTime() > now).length;

  async function add(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    const ok = await act("/api/booking-slots", "POST", { kind, date, time, capacity: Number(capacity), teacher });
    setAdding(false);
    if (ok) setTime("");
  }

  return (
    <div className={styles.panel}>
      <form className={styles.addForm} onSubmit={add}>
        <strong>Add a {BOOKING_LABELS[kind]} slot</strong>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Time (IST)
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label>
          Seats
          <input type="number" min={1} max={50} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
        </label>
        <label>
          Teacher
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)}>
            {TEACHERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button type="submit" className={panelStyles.received} disabled={adding || !date || !time}>
          {adding ? "Adding…" : "Add slot"}
        </button>
      </form>

      {pastCount > 0 && (
        <label className={styles.checkbox}>
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Show past slots ({pastCount})
        </label>
      )}

      {visible.length === 0 ? (
        <div className={panelStyles.empty}>No upcoming slots — add one above so students can book.</div>
      ) : (
        groupSlotsByDate(visible).map((day) => (
          <section key={day.date} className={styles.day}>
            <h3>{formatSlotDate(day.slots[0].startsAt)}</h3>
            <div className={styles.slotList}>
              {day.slots.map((slot) => (
                <SlotRow key={slot.id} slot={slot} act={act} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function SlotRow({ slot, act }: { slot: AdminSlot; act: Act }) {
  const [editing, setEditing] = useState(false);
  const [capacity, setCapacity] = useState(String(slot.capacity));
  const [date, setDate] = useState(slotDateKey(slot.startsAt));
  const [time, setTime] = useState(istTime(slot.startsAt));
  const status = slotStatus(slot);
  const left = Math.max(slot.capacity - slot.booked, 0);
  const pct = Math.min(100, (slot.booked / slot.capacity) * 100);

  async function save() {
    const changes: Record<string, unknown> = {};
    if (Number(capacity) !== slot.capacity) changes.capacity = Number(capacity);
    if (date !== slotDateKey(slot.startsAt) || time !== istTime(slot.startsAt)) Object.assign(changes, { date, time });
    if (Object.keys(changes).length === 0 || (await act(`/api/booking-slots/${slot.id}`, "PATCH", changes))) setEditing(false);
  }

  return (
    <div className={styles.slot}>
      <div className={styles.slotMain}>
        <strong className={styles.slotTime}>{formatSlotTime(slot.startsAt)}</strong>
        <span className={`${styles.status} ${status.className}`}>{status.label}</span>
        <select
          className={styles.teacherSelect}
          value={slot.teacher}
          aria-label="Teacher for this slot"
          title="Who takes this slot. Switching it also moves the students booked with the previous teacher."
          onChange={(e) => act(`/api/booking-slots/${slot.id}`, "PATCH", { teacher: e.target.value })}
        >
          {TEACHERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className={styles.meter} aria-label={`${slot.booked} of ${slot.capacity} seats booked`}>
          <div className={styles.meterBar}><span style={{ width: `${pct}%` }} /></div>
          <small>{slot.booked}/{slot.capacity} booked · {left} left</small>
        </div>
        <div className={styles.slotActions}>
          <button
            type="button"
            className={panelStyles.action}
            onClick={() => {
              if (!editing) {
                setCapacity(String(slot.capacity));
                setDate(slotDateKey(slot.startsAt));
                setTime(istTime(slot.startsAt));
              }
              setEditing(!editing);
            }}
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button type="button" className={panelStyles.action} onClick={() => act(`/api/booking-slots/${slot.id}`, "PATCH", { active: !slot.active })}>
            {slot.active ? "Close" : "Reopen"}
          </button>
          <button
            type="button"
            className={panelStyles.remove}
            disabled={slot.booked > 0}
            title={slot.booked > 0 ? "People have booked this slot — close it instead, or remove their bookings first." : undefined}
            onClick={() => {
              if (window.confirm(`Delete the ${formatSlotTime(slot.startsAt)} slot on ${formatSlotDate(slot.startsAt)}?`)) act(`/api/booking-slots/${slot.id}`, "DELETE");
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className={styles.editRow}>
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Time (IST)<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label>Seats<input type="number" min={Math.max(1, slot.booked)} max={50} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>
          <button type="button" className={panelStyles.received} onClick={save}>Save</button>
        </div>
      )}

      {slot.bookings.length > 0 && (
        <ul className={styles.attendees}>
          {slot.bookings.map((b) => (
            <li key={b.id}>
              <strong>{b.name}</strong> · {b.email}
              {b.level ? ` · ${b.level}` : ""}
              <select
                className={styles.teacherSelect}
                value={b.teacher}
                aria-label={`Teacher for ${b.name}`}
                onChange={(e) => act(`/api/bookings/${b.id}`, "PATCH", { teacher: e.target.value })}
              >
                {TEACHERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {slot.kind === "orientation" && (
                <span className={`${panelStyles.payment} ${b.paidAt ? panelStyles.payment_paid : panelStyles.payment_pending}`}>{b.paidAt ? "Paid" : "Unpaid"}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
