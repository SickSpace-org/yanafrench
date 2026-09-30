// Class attendance rules — shared, pure logic used by the join endpoint,
// the admin Attendance page and the student's Attendance page.
//   - A class session exists on every batch weekday between the batch's
//     start_date and end_date, at the batch's start_time (India time).
//   - Clicking "Join class" from 5 minutes before the class starts until 15 minutes
//     after it marks the student present automatically.
//   - Once that window has closed with no join, the student is absent.
//   - An admin can mark present/absent by hand at any time; a manual mark
//     always wins over the automatic one.

import { addDays, todayInIndia } from "./emiData";
import type { Batch } from "./batchData";

export const JOIN_WINDOW_MINUTES = 15;
// Joining up to this many minutes before the start also counts as present.
export const JOIN_EARLY_MINUTES = 5;

// Every "Join class" button links here (app/api/attendance/join): it
// records attendance, then forwards to the class meeting link.
export const JOIN_CLASS_URL = "/api/attendance/join";
const IST_OFFSET_MINUTES = 330; // UTC+05:30, no daylight saving

export type AttendanceStatus = "present" | "absent";
export type AttendanceSource = "auto" | "manual";

export type AttendanceRecord = {
  id: string;
  studentId: string;
  batchId: string;
  classDate: string; // YYYY-MM-DD, India time
  status: AttendanceStatus;
  source: AttendanceSource;
  markedAt: string;
};

export type AttendanceRow = {
  id: string;
  student_id: string;
  batch_id: string;
  class_date: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  marked_at: string;
};

export function attendanceFromRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    batchId: row.batch_id,
    classDate: row.class_date,
    status: row.status,
    source: row.source,
    markedAt: row.marked_at,
  };
}

// What a student's attendance for one class resolves to right now.
//   present / absent — decided (by a join, a manual mark, or the window closing)
//   open             — the join window is open right now, not joined yet
//   upcoming         — the class hasn't started yet
export type SessionStatus = AttendanceStatus | "open" | "upcoming";

const DAY_CODES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayCode(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return DAY_CODES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// The instant (ms) a batch's class starts on a given India-time date.
export function sessionStart(batch: Pick<Batch, "start_time">, date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = String(batch.start_time || "0:0").split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MINUTES * 60_000;
}

export function joinWindowEnd(batch: Pick<Batch, "start_time">, date: string): number {
  return sessionStart(batch, date) + JOIN_WINDOW_MINUTES * 60_000;
}

export function joinWindowStart(batch: Pick<Batch, "start_time">, date: string): number {
  return sessionStart(batch, date) - JOIN_EARLY_MINUTES * 60_000;
}

export function hasSessionOn(batch: Pick<Batch, "days" | "start_date" | "end_date">, date: string): boolean {
  if (!batch.days.includes(weekdayCode(date))) return false;
  if (batch.start_date && date < batch.start_date) return false;
  if (batch.end_date && date > batch.end_date) return false;
  return true;
}

// Class dates for a batch between two India-time dates (inclusive), newest first.
export function sessionDates(batch: Pick<Batch, "days" | "start_date" | "end_date">, from: string, to: string): string[] {
  const dates: string[] = [];
  for (let d = to; d >= from; d = addDays(d, -1)) {
    if (hasSessionOn(batch, d)) dates.push(d);
  }
  return dates;
}

// Is this batch's join window open at `now`? Returns the class date if so.
export function openSessionDate(batch: Pick<Batch, "days" | "start_date" | "end_date" | "start_time">, now: number = Date.now()): string | null {
  const today = todayInIndia(new Date(now));
  if (!hasSessionOn(batch, today)) return null;
  const start = joinWindowStart(batch, today);
  return now >= start && now <= joinWindowEnd(batch, today) ? today : null;
}

export function resolveSessionStatus(
  batch: Pick<Batch, "start_time">,
  date: string,
  record: Pick<AttendanceRecord, "status"> | null | undefined,
  now: number = Date.now()
): SessionStatus {
  if (record) return record.status;
  if (now < joinWindowStart(batch, date)) return "upcoming";
  if (now <= joinWindowEnd(batch, date)) return "open";
  return "absent";
}
