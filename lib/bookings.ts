// Server-only booking queries (types and formatting: lib/bookingData.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminSlot, Booking, BookingKind, PublicSlot } from "./bookingData";

type SlotRow = { id: string; kind: BookingKind; starts_at: string; capacity: number; active: boolean };
type BookingRow = {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  phone: string;
  level: string | null;
  message: string | null;
  paid_at: string | null;
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
    createdAt: row.created_at,
  };
}

async function bookingsFor(supabase: SupabaseClient, slotIds: string[]): Promise<BookingRow[]> {
  if (slotIds.length === 0) return [];
  const { data, error } = await supabase.from("bookings").select("*").in("slot_id", slotIds).order("created_at");
  if (error) throw error;
  return (data ?? []) as BookingRow[];
}

// Open, upcoming slots with their seat counts. Full slots are included
// (shown as "Full") so people can see the schedule.
export async function listPublicSlots(supabase: SupabaseClient, kind: BookingKind): Promise<PublicSlot[]> {
  const { data, error } = await supabase
    .from("booking_slots")
    .select("id, kind, starts_at, capacity, active")
    .eq("kind", kind)
    .eq("active", true)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;
  const slots = (data ?? []) as SlotRow[];

  const counts = new Map<string, number>();
  for (const b of await bookingsFor(supabase, slots.map((s) => s.id))) {
    counts.set(b.slot_id, (counts.get(b.slot_id) ?? 0) + 1);
  }
  return slots.map((s) => ({
    id: s.id,
    startsAt: new Date(s.starts_at).toISOString(),
    capacity: s.capacity,
    booked: counts.get(s.id) ?? 0,
  }));
}

// Every slot of a kind (past, closed and full ones too) with who booked it.
export async function listAdminSlots(supabase: SupabaseClient, kind: BookingKind): Promise<AdminSlot[]> {
  const { data, error } = await supabase
    .from("booking_slots")
    .select("id, kind, starts_at, capacity, active")
    .eq("kind", kind)
    .order("starts_at");
  if (error) throw error;
  const slots = (data ?? []) as SlotRow[];

  const bySlot = new Map<string, Booking[]>();
  for (const row of await bookingsFor(supabase, slots.map((s) => s.id))) {
    bySlot.set(row.slot_id, [...(bySlot.get(row.slot_id) ?? []), toBooking(row)]);
  }
  return slots.map((s) => {
    const bookings = bySlot.get(s.id) ?? [];
    return {
      id: s.id,
      kind: s.kind,
      startsAt: new Date(s.starts_at).toISOString(),
      capacity: s.capacity,
      active: s.active,
      booked: bookings.length,
      bookings,
    };
  });
}

export type BookSlotFailure = "slot_not_found" | "slot_closed" | "slot_past" | "slot_full" | "already_booked";

const FAILURES: BookSlotFailure[] = ["slot_not_found", "slot_closed", "slot_past", "slot_full", "already_booked"];

// Takes a seat through the book_slot() Postgres function, which locks the
// slot while it counts — so a slot can never go over capacity.
export async function bookSlot(
  supabase: SupabaseClient,
  input: { slotId: string; name: string; email: string; phone: string; level: string | null; message: string | null }
): Promise<{ ok: true; bookingId: string; slot: SlotRow } | { ok: false; reason: BookSlotFailure | "error" }> {
  const { data, error } = await supabase.rpc("book_slot", {
    p_slot_id: input.slotId,
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
    p_level: input.level,
    p_message: input.message,
  });
  if (error) {
    const reason = FAILURES.find((f) => error.message?.includes(f));
    if (!reason) console.error("book_slot failed", input.slotId, error);
    return { ok: false, reason: reason ?? "error" };
  }

  const { data: slot, error: slotError } = await supabase
    .from("booking_slots")
    .select("id, kind, starts_at, capacity, active")
    .eq("id", input.slotId)
    .single();
  if (slotError || !slot) return { ok: false, reason: "error" };
  return { ok: true, bookingId: data as string, slot: slot as SlotRow };
}
