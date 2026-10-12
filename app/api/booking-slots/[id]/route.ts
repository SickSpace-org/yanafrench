import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { istToIso } from "@/lib/bookingData";

// PATCH { capacity?, active?, date?, time? } — Admin -> Bookings' slot edits.
// Seats can't go below the bookings already in the slot.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { capacity?: unknown; active?: unknown; date?: unknown; time?: unknown } | null;
  if (!body) return new Response("Invalid request.", { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.capacity !== undefined) {
    const capacity = Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) return new Response("Seats must be between 1 and 50.", { status: 400 });
    const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).eq("slot_id", id);
    if ((count ?? 0) > capacity) return new Response(`${count} people have already booked this slot — seats can't go below that.`, { status: 409 });
    update.capacity = capacity;
  }
  if (typeof body.active === "boolean") update.active = body.active;
  if (body.date !== undefined || body.time !== undefined) {
    const startsAt = istToIso(String(body.date ?? ""), String(body.time ?? ""));
    if (!startsAt) return new Response("Pick a date and a time.", { status: 400 });
    update.starts_at = startsAt;
  }
  if (Object.keys(update).length === 0) return Response.json({ ok: true });

  const { error } = await supabase.from("booking_slots").update(update).eq("id", id);
  if (error) {
    if (error.code === "23505") return new Response("There's already a slot at that date and time.", { status: 409 });
    console.error("Failed to update booking slot", id, error);
    return new Response("Couldn't update the slot.", { status: 500 });
  }
  return Response.json({ ok: true });
}

// DELETE — removes a slot. A slot that people have booked can't be
// deleted (close it instead, or remove the bookings first).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).eq("slot_id", id);
  if ((count ?? 0) > 0) return new Response("People have booked this slot — close it instead, or remove their bookings first.", { status: 409 });

  const { error } = await supabase.from("booking_slots").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete booking slot", id, error);
    return new Response("Couldn't delete the slot.", { status: 500 });
  }
  return Response.json({ ok: true });
}
