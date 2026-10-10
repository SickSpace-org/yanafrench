// Shared batch types + the recurrence logic that turns a batch's weekly
// schedule into calendar class events. Batches themselves are admin-edited
// content living on the shared portal state (see lib/portalState.ts) — the
// same live document that already backs Available Batches on the public
// site and, via generateClassEvents below, the student's calendar.

import { site } from "./site";

export type ClassEvent = {
  id: string;
  batchId: string;
  title: string;
  date: Date;
  time: string;
  course: BatchCourse;
  teacher: string;
  meetingLink?: string;
};

export type BatchCourse = "TEF" | "TCF" | "DELF";
export type BatchStatus = "available" | "few_seats" | "full" | "waitlist";

// One recurring class time of a batch: the weekdays that share this time.
// "Varshita — TEF" is ONE batch with two slots:
//   [{ days: ["Tue","Wed","Thu","Fri"], 13:00–14:00 }, { days: ["Sat"], 13:30–14:30 }]
// Rule: a weekday appears in at most one slot — one class per batch per
// day (attendance is one row per student, batch and date; see
// validateSlots). Times are India time, "HH:MM" 24h; an end before the
// start means the class runs past midnight.
export type BatchSlot = {
  days: string[]; // subset of DAYS below
  start_time: string;
  end_time: string;
};

export type Batch = {
  id: string;
  course: BatchCourse;
  level?: string | null;
  name: string;
  slots: BatchSlot[];
  start_date?: string | null; // "YYYY-MM-DD"
  end_date?: string | null;
  total_seats: number;
  seats_remaining: number;
  status: BatchStatus;
  published: boolean;
  // Marks the one batch that's this student's own class — its schedule is
  // what generates her recurring "class" events on the calendar. Only one
  // batch should carry this at a time; every other batch is public-only
  // (shown to prospects in Available Batches, nothing more).
  isCurrent: boolean;
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAY_LABELS: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};
const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_CODES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// What a batch looks like inside the stored R2 document. Batches saved
// before slots existed carry a single days/start_time/end_time instead; the
// current code still writes those three as a mirror of the first slot, so an
// older deployment reading the document keeps working (see storedBatch).
export type StoredBatch = Omit<Batch, "slots"> & {
  slots?: BatchSlot[];
  days?: string[];
  start_time?: string;
  end_time?: string;
};

function cleanSlot(slot: Partial<BatchSlot> | null | undefined, taken: Set<string>): BatchSlot | null {
  if (!slot || !Array.isArray(slot.days)) return null;
  const days = DAYS.filter((d) => slot.days!.includes(d) && !taken.has(d));
  if (days.length === 0) return null;
  days.forEach((d) => taken.add(d));
  return { days, start_time: String(slot.start_time ?? ""), end_time: String(slot.end_time ?? "") };
}

// Any stored batch → the current shape. Old single-timing batches become one
// slot; a weekday listed in two slots keeps only its first. Idempotent, so
// it's safe on both the server read and the client.
export function normalizeBatch(raw: StoredBatch | Batch): Batch {
  const { days, start_time, end_time, slots, ...rest } = raw as StoredBatch;
  const taken = new Set<string>();
  const source: Partial<BatchSlot>[] =
    Array.isArray(slots) && slots.length > 0 ? slots : Array.isArray(days) ? [{ days, start_time, end_time }] : [];
  return { ...rest, slots: source.map((s) => cleanSlot(s, taken)).filter((s): s is BatchSlot => s !== null) };
}

// The stored form: slots, plus the legacy single-timing fields mirrored from
// the first slot for any older deployment still reading the document.
export function storedBatch(batch: Batch): StoredBatch {
  const first = batch.slots[0];
  return { ...batch, days: first?.days ?? [], start_time: first?.start_time ?? "", end_time: first?.end_time ?? "" };
}

// Problems with a batch's slots, or null if they're valid: at least one
// slot, every slot has a day and valid times, no weekday in two slots.
export function validateSlots(slots: unknown): string | null {
  if (!Array.isArray(slots) || slots.length === 0) return "Add at least one day and time.";
  const seen = new Set<string>();
  for (const slot of slots as Partial<BatchSlot>[]) {
    if (!slot || !Array.isArray(slot.days) || slot.days.length === 0) return "Every time slot needs at least one day.";
    if (!TIME_RE.test(String(slot.start_time)) || !TIME_RE.test(String(slot.end_time))) return "Every time slot needs a start and end time.";
    if (slot.start_time === slot.end_time) return "A class can't start and end at the same time.";
    for (const d of slot.days) {
      if (!(DAYS as readonly string[]).includes(d)) return `Unknown day "${d}".`;
      if (seen.has(d)) return `${DAY_LABELS[d]} is in two time slots — a batch has at most one class per day.`;
      seen.add(d);
    }
  }
  return null;
}

// Every weekday the batch meets, in week order.
export function batchDays(batch: Pick<Batch, "slots">): string[] {
  return DAYS.filter((d) => batch.slots.some((s) => s.days.includes(d)));
}

// The slot that holds class on a weekday code ("Mon"…), if any.
export function slotForDay(batch: Pick<Batch, "slots">, day: string): BatchSlot | null {
  return batch.slots.find((s) => s.days.includes(day)) ?? null;
}

// The slot for a calendar date ("YYYY-MM-DD"), by its weekday.
export function slotForDate(batch: Pick<Batch, "slots">, date: string): BatchSlot | null {
  const [y, m, d] = date.split("-").map(Number);
  return slotForDay(batch, DAY_CODES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]);
}

// Earliest start time across slots — the sort key for "by time" lists.
export function earliestStart(batch: Pick<Batch, "slots">): string {
  return batch.slots.map((s) => s.start_time).sort()[0] ?? "";
}

export function formatTime(value: string) {
  const [h = "0", m = "00"] = String(value || "").split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${suffix}`;
}

// Renders a batch's weekday set for scanning at a glance: a contiguous
// 3+ day run collapses to "Mon – Sat", otherwise days are listed in
// week order ("Tue, Thu, Fri, Sat"). Used by the unique-batch table on
// the public site (see components/BatchFinder.tsx) so admin-entered day
// order (whatever order they were toggled in) never leaks into the UI.
export function formatDays(days: string[]) {
  const ordered = DAYS.filter((d) => days.includes(d));
  if (ordered.length === 0) return "";
  if (ordered.length <= 2) return ordered.join(", ");

  const indexes = ordered.map((d) => DAYS.indexOf(d));
  const isContiguous = indexes.every((idx, i) => i === 0 || idx === indexes[i - 1] + 1);
  return isContiguous ? `${ordered[0]} – ${ordered[ordered.length - 1]}` : ordered.join(", ");
}

export function formatSlot(slot: BatchSlot): string {
  return `${formatDays(slot.days)} ${formatTime(slot.start_time)}–${formatTime(slot.end_time)}`;
}

// The whole weekly schedule on one line, slots in week order:
// "Tue – Fri 1:00 PM–2:00 PM · Sat 1:30 PM–2:30 PM".
export function formatSchedule(batch: Pick<Batch, "slots">): string {
  const firstDay = (slot: BatchSlot) => Math.min(...slot.days.map((d) => DAYS.indexOf(d as (typeof DAYS)[number])));
  return [...batch.slots].sort((a, b) => firstDay(a) - firstDay(b)).map(formatSlot).join(" · ");
}

export function statusText(batch: Batch) {
  if (batch.status === "waitlist") return "Waitlist";
  if (batch.status === "full" || batch.seats_remaining <= 0) return "Full";
  if (batch.status === "few_seats") {
    return batch.seats_remaining === 1 ? "1 seat left" : `${batch.seats_remaining} seats left`;
  }
  return "Available";
}

// Recurring "class" calendar events for the given batch, from today (or
// its start_date if later) out to `horizonDays`, capped at its end_date if
// it has one. There's no persisted per-occurrence data — each week's class
// is derived fresh from the batch's slots every time the calendar renders,
// so an admin edit to the batch instantly reshapes every future occurrence
// instead of leaving stale copies behind. Each day uses its own slot's time.
export function generateClassEvents(batch: Batch, meetingLink: string, horizonDays = 90): ClassEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = batch.start_date ? new Date(`${batch.start_date}T00:00:00`) : today;
  const rangeStart = start > today ? start : today;

  const cap = new Date(today);
  cap.setDate(cap.getDate() + horizonDays);
  const end = batch.end_date ? new Date(`${batch.end_date}T00:00:00`) : cap;
  const rangeEnd = end < cap ? end : cap;

  const slotByIndex = new Map<number, BatchSlot>();
  for (const slot of batch.slots) for (const d of slot.days) if (DAY_INDEX[d] !== undefined) slotByIndex.set(DAY_INDEX[d], slot);

  const events: ClassEvent[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const slot = slotByIndex.get(cursor.getDay());
    if (slot) {
      events.push({
        id: `class-${batch.id}-${cursor.toISOString().slice(0, 10)}`,
        batchId: batch.id,
        title: `${batch.name} · Live class`,
        date: new Date(cursor),
        time: `${formatTime(slot.start_time)}–${formatTime(slot.end_time)}`,
        course: batch.course,
        teacher: site.tutor,
        meetingLink: meetingLink || undefined,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return events;
}
