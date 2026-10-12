// Server-only booking queries (types and formatting: lib/bookingData.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TEACHER, type AdminSlot, type Booking, type BookingKind, type PublicSlot } from "./bookingData";

type SlotRow = { id: string; kind: BookingKind; starts_at: string; capacity: number; active: boolean; teacher: string };
type BookingRow = {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  phone: string;
  level: string | null;
  message: string | null;
  paid_at: string | null;
  teacher: string | null;
  created_at: string;
};

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    slotId: row.slot_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    level: row.level,
    message: row.message,
    paidAt: row.paid_at,
    teacher: row.teacher ?? DEFAULT_TEACHER,
    createdAt: row.created_at,
  };
}

// Each list is a single query: PostgREST embeds the slot's bookings (or
// just their count) in the same request.

// Open, upcoming slots with their seat counts. Full slots are included
// (shown as "Full") so people can see the schedule.
export async function listPublicSlots(supabase: SupabaseClient, kind: BookingKind): Promise<PublicSlot[]> {
  const { data, error } = await supabase
    .from("booking_slots")
    .select("id, starts_at, capacity, bookings(count)")
    .eq("kind", kind)
    .eq("active", true)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;
  const slots = (data ?? []) as { id: string; starts_at: string; capacity: number; bookings: { count: number }[] }[];
  return slots.map((s) => ({
    id: s.id,
    startsAt: new Date(s.starts_at).toISOString(),
    capacity: s.capacity,
    booked: s.bookings[0]?.count ?? 0,
  }));
}

// Every slot of a kind (past, closed and full ones too) with who booked it.
export async function listAdminSlots(supabase: SupabaseClient, kind: BookingKind): Promise<AdminSlot[]> {
  const { data, error } = await supabase
    .from("booking_slots")
    .select("id, kind, starts_at, capacity, active, teacher, bookings(*)")
    .eq("kind", kind)
    .order("starts_at");
  if (error) throw error;
  const slots = (data ?? []) as (SlotRow & { bookings: BookingRow[] })[];
  return slots.map((s) => {
    const bookings = [...s.bookings].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(toBooking);
    return {
      id: s.id,
      kind: s.kind,
      startsAt: new Date(s.starts_at).toISOString(),
      capacity: s.capacity,
      active: s.active,
      teacher: s.teacher,
      booked: bookings.length,
      bookings,
    };
  });
}

export type BookSlotFailure = "slot_not_found" | "wrong_kind" | "slot_closed" | "slot_past" | "slot_full" | "already_booked";

const FAILURES: BookSlotFailure[] = ["slot_not_found", "wrong_kind", "slot_closed", "slot_past", "slot_full", "already_booked"];

export type BookedSlot = { bookingId: string; startsAt: string; capacity: number; booked: number };

// Takes a seat through the reserve_slot() Postgres function in one round
// trip. It locks the slot while it counts, so a slot can never go over
// capacity, and checks the slot belongs to the kind being booked.
export async function bookSlot(
  supabase: SupabaseClient,
  input: { kind: BookingKind; slotId: string; name: string; email: string; phone: string; level: string | null; message: string | null }
): Promise<({ ok: true } & BookedSlot) | { ok: false; reason: BookSlotFailure | "error" }> {
  const { data, error } = await supabase.rpc("reserve_slot", {
    p_slot_id: input.slotId,
    p_kind: input.kind,
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
    p_level: input.level,
    p_message: input.message,
  });
  if (error) {
    const reason = FAILURES.find((f) => error.message?.includes(f));
    if (!reason) console.error("reserve_slot failed", input.slotId, error);
    return { ok: false, reason: reason ?? "error" };
  }
  const row = data as { id: string; starts_at: string; capacity: number; booked: number };
  return { ok: true, bookingId: row.id, startsAt: new Date(row.starts_at).toISOString(), capacity: row.capacity, booked: row.booked };
}
