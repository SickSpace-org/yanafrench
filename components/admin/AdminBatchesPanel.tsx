"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DAYS, DAY_LABELS, validateSlots, type Batch, type BatchCourse, type BatchSlot, type BatchStatus } from "@/lib/batchData";
import styles from "./AdminBatchesPanel.module.css";

const COURSES: BatchCourse[] = ["TEF", "TCF", "DELF"];
const STATUSES: BatchStatus[] = ["available", "few_seats", "full", "waitlist"];
const STATUS_LABELS: Record<BatchStatus, string> = {
  available: "Available",
  few_seats: "Few seats",
  full: "Full",
  waitlist: "Waitlist",
};

// Days already used by another slot of the same batch are disabled — a batch
// has at most one class per day (lib/batchData.ts validateSlots).
function DayPicker({ value, taken, onChange }: { value: string[]; taken: Set<string>; onChange: (days: string[]) => void }) {
  function toggle(day: string) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : DAYS.filter((d) => d === day || value.includes(d)));
  }
  return (
    <div className={styles.dayPicker}>
      {DAYS.map((day) => {
        const blocked = taken.has(day) && !value.includes(day);
        return (
          <button
            key={day}
            type="button"
            className={value.includes(day) ? styles.dayChipActive : styles.dayChip}
            disabled={blocked}
            title={blocked ? `${DAY_LABELS[day]} already has a class time in this batch` : undefined}
            onClick={() => toggle(day)}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

const NEW_SLOT: BatchSlot = { days: [], start_time: "09:30", end_time: "10:30" };

// A batch's weekly schedule: one row per time slot (days + start/end). A
// batch that meets Tue–Fri at 1:00 PM and Sat at 1:30 PM is one batch with
// two rows, not two batches.
function SlotsEditor({ value, onChange }: { value: BatchSlot[]; onChange: (slots: BatchSlot[]) => void }) {
  const update = (i: number, patch: Partial<BatchSlot>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className={styles.slots}>
      {value.map((slot, i) => {
        const taken = new Set(value.flatMap((s, j) => (j === i ? [] : s.days)));
        return (
          <div key={i} className={styles.slot}>
            <DayPicker value={slot.days} taken={taken} onChange={(days) => update(i, { days })} />
            <label>
              <span>Start</span>
              <input type="time" value={slot.start_time} onChange={(e) => update(i, { start_time: e.target.value })} required />
            </label>
            <label>
              <span>End</span>
              <input type="time" value={slot.end_time} onChange={(e) => update(i, { end_time: e.target.value })} required />
            </label>
            {value.length > 1 && (
              <button type="button" className={styles.slotRemove} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                Remove
              </button>
            )}
          </div>
        );
      })}
      {value.flatMap((s) => s.days).length < DAYS.length && (
        <button
          type="button"
          className={styles.slotAdd}
          onClick={() => {
            const last = value[value.length - 1] ?? NEW_SLOT;
            onChange([...value, { days: [], start_time: last.start_time, end_time: last.end_time }]);
          }}
        >
          + Add another day &amp; time
        </button>
      )}
    </div>
  );
}

function NewBatchForm({ onAdd }: { onAdd: (batch: Batch) => void }) {
  const [course, setCourse] = useState<BatchCourse>("TEF");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [slots, setSlots] = useState<BatchSlot[]>([NEW_SLOT]);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalSeats, setTotalSeats] = useState(4);
  const [status, setStatus] = useState<BatchStatus>("available");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateSlots(slots);
    setSlotError(problem);
    if (!name.trim() || problem) return;
    onAdd({
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      course,
      level: level.trim() || null,
      name: name.trim(),
      slots,
      start_date: startDate || null,
      end_date: endDate || null,
      total_seats: totalSeats,
      seats_remaining: totalSeats,
      status,
      published: true,
      isCurrent: false,
    });
    setName("");
    setLevel("");
    setSlots([NEW_SLOT]);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2>New batch</h2>
      <div className={styles.fieldGrid}>
        <label>
          <span>Course</span>
          <select value={course} onChange={(e) => setCourse(e.target.value as BatchCourse)}>
            {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          <span>Batch name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. TEF Weekday Evening" required />
        </label>
        <label>
          <span>Level (optional)</span>
          <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="e.g. B1" />
        </label>
      </div>

      <div className={styles.fullWidth}>
        <span>Days &amp; times</span>
        <SlotsEditor value={slots} onChange={setSlots} />
        {slotError && <p className={styles.slotError}>{slotError}</p>}
      </div>

      <div className={styles.fieldGrid}>
        <label>
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as BatchStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label>
          <span>Start date (optional)</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          <span>End date (optional)</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label>
          <span>Total seats</span>
          <input type="number" min={1} value={totalSeats} onChange={(e) => setTotalSeats(Number(e.target.value) || 1)} />
        </label>
      </div>

      <button type="submit" className={styles.save}>Add batch</button>
    </form>
  );
}

function BatchRow({
  batch,
  onUpdate,
  onRemove,
  onSetCurrent,
}: {
  batch: Batch;
  onUpdate: (patch: Partial<Batch>) => void;
  onRemove: () => void;
  onSetCurrent: () => void;
}) {
  // The schedule is edited as a draft and saved with one click, so a
  // half-finished slot (no days yet) is never stored.
  const savedKey = JSON.stringify(batch.slots);
  const [slots, setSlots] = useState<BatchSlot[]>(batch.slots);
  const dirty = JSON.stringify(slots) !== savedKey;
  const problem = dirty ? validateSlots(slots) : null;
  useEffect(() => {
    if (!dirty) setSlots(batch.slots);
    // Only when the stored schedule changes (e.g. another admin's edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  return (
    <div className={batch.published ? styles.row : `${styles.row} ${styles.draftRow}`}>
      <div className={styles.rowHead}>
        <input
          className={styles.rowTitleInput}
          defaultValue={batch.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== batch.name && onUpdate({ name: e.target.value.trim() })}
        />
        <div className={styles.rowBadges}>
          {batch.isCurrent ? (
            <button type="button" className={styles.currentBadge} onClick={() => onUpdate({ isCurrent: false })}>
              Her main {batch.course} batch — click to unset
            </button>
          ) : (
            <button type="button" className={styles.setCurrent} onClick={onSetCurrent}>Mark as her main {batch.course} batch</button>
          )}
          <button type="button" className={batch.published ? styles.publishedBadge : styles.draftBadge} onClick={() => onUpdate({ published: !batch.published })}>
            {batch.published ? "Published" : "Draft"}
          </button>
        </div>
      </div>

      <div className={styles.fieldGrid}>
        <label>
          <span>Course</span>
          <select value={batch.course} onChange={(e) => onUpdate({ course: e.target.value as BatchCourse })}>
            {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          <span>Level</span>
          <input
            defaultValue={batch.level ?? ""}
            onBlur={(e) => e.target.value !== (batch.level ?? "") && onUpdate({ level: e.target.value || null })}
          />
        </label>
        <label>
          <span>Status</span>
          <select value={batch.status} onChange={(e) => onUpdate({ status: e.target.value as BatchStatus })}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label>
          <span>Seats remaining</span>
          <input
            type="number"
            min={0}
            max={batch.total_seats}
            defaultValue={batch.seats_remaining}
            onBlur={(e) => Number(e.target.value) !== batch.seats_remaining && onUpdate({ seats_remaining: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          <span>Total seats</span>
          <input
            type="number"
            min={1}
            defaultValue={batch.total_seats}
            onBlur={(e) => Number(e.target.value) !== batch.total_seats && onUpdate({ total_seats: Number(e.target.value) || 1 })}
          />
        </label>
      </div>

      <div className={styles.fullWidth}>
        <span>Days &amp; times</span>
        <SlotsEditor value={slots} onChange={setSlots} />
        {dirty && (
          <div className={styles.slotActions}>
            <button type="button" className={styles.save} disabled={!!problem} onClick={() => onUpdate({ slots })}>
              Save schedule
            </button>
            <button type="button" className={styles.slotRemove} onClick={() => setSlots(batch.slots)}>
              Discard changes
            </button>
            {problem && <p className={styles.slotError}>{problem}</p>}
          </div>
        )}
      </div>

      <div className={styles.fieldGrid}>
        <label>
          <span>Start date</span>
          <input type="date" defaultValue={batch.start_date ?? ""} onBlur={(e) => e.target.value !== (batch.start_date ?? "") && onUpdate({ start_date: e.target.value || null })} />
        </label>
        <label>
          <span>End date</span>
          <input type="date" defaultValue={batch.end_date ?? ""} onBlur={(e) => e.target.value !== (batch.end_date ?? "") && onUpdate({ end_date: e.target.value || null })} />
        </label>
      </div>

      <button type="button" className={styles.remove} onClick={onRemove}>Delete</button>
    </div>
  );
}

// Admin-managed class batches — feeds two live surfaces from one shared
// portal-state list: the public site's Available Batches section (every
// published batch) and, for whichever one is flagged isCurrent, the
// student's recurring class events on her calendar (see
// lib/batchData.ts's generateClassEvents, used by components/CalendarPage).
export function AdminBatchesPanel({
  batches,
  onAdd,
  onUpdate,
  onRemove,
  onSetCurrent,
}: {
  batches: Batch[];
  onAdd: (batch: Batch) => void;
  onUpdate: (id: string, patch: Partial<Batch>) => void;
  onRemove: (id: string) => void;
  onSetCurrent: (id: string) => void;
}) {
  return (
    <div className={styles.panel}>
      <NewBatchForm onAdd={onAdd} />

      <div className={styles.list}>
        {batches.map((batch) => (
          <BatchRow
            key={batch.id}
            batch={batch}
            onUpdate={(patch) => onUpdate(batch.id, patch)}
            onRemove={() => onRemove(batch.id)}
            onSetCurrent={() => onSetCurrent(batch.id)}
          />
        ))}
      </div>
    </div>
  );
}
