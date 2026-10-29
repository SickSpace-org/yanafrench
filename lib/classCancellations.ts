// Cancelled classes (server only, service-role client). Admin -> Attendance
// or the batch's teacher cancels one class of a batch (batch + India-time
// date): every student actively in the batch is emailed, and the class
// shows as cancelled in both registers and across the Student Hub
// (dashboard, calendar, attendance). Restoring deletes the row and, for a
// class still ahead, emails the students that it's back on. A cancelled
// class never counts toward attendance — see lib/attendance.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { formatTime, slotForDate, type Batch } from "./batchData";
import { hasSessionOn, type ClassCancellation } from "./attendanceData";
import { addDays, todayInIndia } from "./emiData";
import { sendClassCancelledEmail, sendClassRestoredEmail } from "./email";
import { SITE_URL } from "./site";

// How far back / ahead a class can be cancelled — back matches the
// register's REGISTER_DAYS (lib/attendance.ts).
export const CANCEL_BACK_DAYS = 30;
export const CANCEL_AHEAD_DAYS = 30;
const NOTE_MAX = 300;

// 'admin' | 'teacher:<teachers.id>', as attendance.marked_by.
export type CancelledBy = "admin" | `teacher:${string}`;

export type CancellationRecord = ClassCancellation & { cancelledBy: string; cancelledAt: string };

type Row = { batch_id: string; class_date: string; note: string | null; cancelled_by: string; cancelled_at: string };

// batchIds null = every batch. A failed read (e.g. the table isn't created
// yet) logs and reads as "nothing cancelled", so attendance keeps working.
export async function getCancellations(
  supabase: SupabaseClient,
  batchIds: string[] | null,
  range: { from?: string; to?: string } = {}
): Promise<CancellationRecord[]> {
  if (batchIds && batchIds.length === 0) return [];
  let query = supabase.from("class_cancellations").select("batch_id, class_date, note, cancelled_by, cancelled_at");
  if (batchIds) query = query.in("batch_id", batchIds);
  if (range.from) query = query.gte("class_date", range.from);
  if (range.to) query = query.lte("class_date", range.to);
  const { data, error } = await query;
  if (error) {
    console.error("Failed to load class cancellations", error);
    return [];
  }
  return ((data as Row[]) ?? []).map((r) => ({
    batchId: r.batch_id,
    date: r.class_date,
    note: r.note,
    cancelledBy: r.cancelled_by,
    cancelledAt: r.cancelled_at,
  }));
}

export function cleanNote(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const note = input.trim().replace(/\s+/g, " ").slice(0, NOTE_MAX);
  return note || null;
}

// A real class of that batch, within the window. Returns an error message or null.
export function validateCancelDate(batch: Batch, date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !hasSessionOn(batch, date)) return "No class on that date.";
  const today = todayInIndia();
  if (date < addDays(today, -CANCEL_BACK_DAYS) || date > addDays(today, CANCEL_AHEAD_DAYS)) return "That class is outside the dates you can cancel.";
  return null;
}

// "Thursday, 30 Oct 2026 at 7:00 PM IST"
export function formatClassWhen(batch: Batch, date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
  const slot = slotForDate(batch, date);
  return slot ? `${day} at ${formatTime(slot.start_time)} IST` : day;
}

type Recipient = { email: string; name: string };

// One email at a time with a short gap, to stay under Resend's per-second
// rate limit — a batch is a handful of students, and this runs in after().
async function emailEach(recipients: Recipient[], send: (r: Recipient) => Promise<boolean>, what: string) {
  for (const [i, r] of recipients.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 300));
    await send(r).catch((err) => console.error(`Failed to send ${what} email`, r.email, err));
  }
}

async function batchRecipients(supabase: SupabaseClient, batchId: string): Promise<Recipient[]> {
  const { data, error } = await supabase.from("batch_enrollments").select("students(email, name)").eq("batch_id", batchId).eq("status", "active");
  if (error) throw error;
  type Join = { students: { email: string | null; name: string | null } | null };
  const byEmail = new Map<string, Recipient>();
  for (const e of (data as unknown as Join[]) ?? []) {
    const email = e.students?.email?.trim();
    if (email) byEmail.set(email.toLowerCase(), { email, name: e.students?.name ?? "" });
  }
  return [...byEmail.values()];
}

export type CancelResult = { ok: true; emailed: number } | { ok: false; status: number; message: string };

// Students are only emailed for a class that's today or later — a past
// class being marked cancelled is just record-keeping.
export async function cancelClass(
  supabase: SupabaseClient,
  batch: Batch,
  input: { date: string; note: string | null; by: CancelledBy }
): Promise<CancelResult> {
  const { data, error } = await supabase
    .from("class_cancellations")
    .upsert(
      { batch_id: batch.id, class_date: input.date, note: input.note, cancelled_by: input.by, cancelled_at: new Date().toISOString() },
      { onConflict: "batch_id,class_date", ignoreDuplicates: true }
    )
    .select("batch_id");
  if (error) {
    console.error("Failed to cancel class", batch.id, input.date, error);
    return { ok: false, status: 500, message: "Couldn't cancel the class." };
  }
  if (!data || data.length === 0) return { ok: false, status: 409, message: "That class is already cancelled." };

  if (input.date < todayInIndia()) return { ok: true, emailed: 0 };
  const recipients = await batchRecipients(supabase, batch.id).catch((err) => {
    console.error("Failed to load students to email about a cancelled class", batch.id, err);
    return [] as Recipient[];
  });
  const when = formatClassWhen(batch, input.date);
  after(() =>
    emailEach(
      recipients,
      (r) => sendClassCancelledEmail(r.email, { name: r.name, course: batch.course, batchName: batch.name, when, note: input.note, hubUrl: `${SITE_URL}/student-hub` }),
      "class cancelled"
    )
  );
  return { ok: true, emailed: recipients.length };
}

export async function restoreClass(supabase: SupabaseClient, batch: Batch, date: string): Promise<CancelResult> {
  const { data, error } = await supabase.from("class_cancellations").delete().eq("batch_id", batch.id).eq("class_date", date).select("batch_id");
  if (error) {
    console.error("Failed to restore class", batch.id, date, error);
    return { ok: false, status: 500, message: "Couldn't restore the class." };
  }
  if (!data || data.length === 0) return { ok: false, status: 404, message: "That class isn't cancelled." };

  if (date < todayInIndia()) return { ok: true, emailed: 0 };
  const recipients = await batchRecipients(supabase, batch.id).catch((err) => {
    console.error("Failed to load students to email about a restored class", batch.id, err);
    return [] as Recipient[];
  });
  const when = formatClassWhen(batch, date);
  after(() =>
    emailEach(
      recipients,
      (r) => sendClassRestoredEmail(r.email, { name: r.name, course: batch.course, batchName: batch.name, when, hubUrl: `${SITE_URL}/student-hub` }),
      "class restored"
    )
  );
  return { ok: true, emailed: recipients.length };
}
