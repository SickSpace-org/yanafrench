// Time-slot booking for the Orientation Test and the free Demo Class.
// Shared by the public booking modal, Admin -> Bookings and the API routes
// (server-side queries live in lib/bookings.ts). Each kind has its own
// slots in booking_slots, so seats are counted separately.

export type BookingKind = "orientation" | "demo";

export const BOOKING_KINDS: BookingKind[] = ["orientation", "demo"];

export const BOOKING_LABELS: Record<BookingKind, string> = {
  orientation: "Orientation Test",
  demo: "Demo Class",
};

export const DEFAULT_SLOT_CAPACITY = 5;

// Only the Orientation Test is paid; the Demo Class is free.
export const BOOKING_IS_PAID: Record<BookingKind, boolean> = { orientation: true, demo: false };

// Who takes a slot. Each slot has a teacher, and each booking starts with
// its slot's teacher; the admin can switch a booking to the other teacher
// (e.g. when both offer the same time).
export const TEACHERS = ["Yana", "Harnoor"] as const;
export type Teacher = (typeof TEACHERS)[number];
export const DEFAULT_TEACHER: Teacher = "Yana";

export function isTeacher(value: unknown): value is Teacher {
  return TEACHERS.includes(value as Teacher);
}

export function isBookingKind(value: unknown): value is BookingKind {
  return value === "orientation" || value === "demo";
}

// What the public site sees — seat counts only, never who booked.
export type PublicSlot = {
  id: string;
  startsAt: string; // ISO
  capacity: number;
  booked: number;
};

export type Booking = {
  id: string;
  slotId: string;
  name: string;
  email: string;
  phone: string;
  level: string | null;
  message: string | null;
  // Orientation Test only — when the admin marked the fee as received.
  paidAt: string | null;
  teacher: string;
  createdAt: string;
};

export type AdminSlot = PublicSlot & {
  kind: BookingKind;
  active: boolean;
  teacher: string;
  bookings: Booking[];
};

// Slots are run in India; every time on the site and in emails is IST.
const TIME_ZONE = "Asia/Kolkata";

export function slotDateKey(iso: string): string {
  // en-CA formats as YYYY-MM-DD, which sorts and groups cleanly.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function formatSlotDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export function formatSlotDay(iso: string): { weekday: string; day: string; month: string } {
  const d = new Date(iso);
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, ...opts }).format(d);
  return { weekday: part({ weekday: "short" }), day: part({ day: "numeric" }), month: part({ month: "short" }) };
}

export function formatSlotTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .toUpperCase();
}

// "Monday, 12 October 2026 at 7:00 PM IST"
export function formatSlotWhen(iso: string): string {
  return `${formatSlotDate(iso)} at ${formatSlotTime(iso)} IST`;
}

// Admin's "add a slot" form gives a date and a time in IST.
export function istToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function groupSlotsByDate<T extends { startsAt: string }>(slots: T[]): { date: string; slots: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const slot of [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const key = slotDateKey(slot.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  return [...groups].map(([date, slots]) => ({ date, slots }));
}
