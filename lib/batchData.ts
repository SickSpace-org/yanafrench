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

export type Batch = {
  id: string;
  course: BatchCourse;
  level?: string | null;
  name: string;
  days: string[]; // subset of DAYS below, e.g. ["Mon", "Wed", "Fri"]
  start_time: string; // "HH:MM", 24h
  end_time: string;
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

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_LABELS: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};
const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

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
// is derived fresh from the batch's days/times every time the calendar
// renders, so an admin edit to the batch instantly reshapes every future
// occurrence instead of leaving stale copies behind.
export function generateClassEvents(batch: Batch, meetingLink: string, horizonDays = 90): ClassEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = batch.start_date ? new Date(`${batch.start_date}T00:00:00`) : today;
  const rangeStart = start > today ? start : today;

  const cap = new Date(today);
  cap.setDate(cap.getDate() + horizonDays);
  const end = batch.end_date ? new Date(`${batch.end_date}T00:00:00`) : cap;
  const rangeEnd = end < cap ? end : cap;

  const dayIndexes = new Set(batch.days.map((d) => DAY_INDEX[d]).filter((i) => i !== undefined));
  const timeLabel = `${formatTime(batch.start_time)}–${formatTime(batch.end_time)}`;

  const events: ClassEvent[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    if (dayIndexes.has(cursor.getDay())) {
      events.push({
        id: `class-${batch.id}-${cursor.toISOString().slice(0, 10)}`,
        batchId: batch.id,
        title: `${batch.name} · Live class`,
        date: new Date(cursor),
        time: timeLabel,
        course: batch.course,
        teacher: site.tutor,
        meetingLink: meetingLink || undefined,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return events;
}
