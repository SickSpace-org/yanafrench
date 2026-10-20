import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { BOOKING_LABELS, formatSlotWhen, isTeacher } from "@/lib/bookingData";
import { readCatalog } from "@/lib/courseCatalogServer";
import { formatRupees } from "@/lib/formatCurrency";
import { sendBookingPaymentConfirmedEmail } from "@/lib/email";
import { whatsappDisplay, whatsappUrl } from "@/lib/site";

// PATCH { paid?: boolean, teacher?: "Yana" | "Harnoor" } — Admin -> Bookings.
// teacher: assign the booking to either teacher (any booking).
// paid: move an Orientation Test booking between Unpaid and Paid; moving it
// to Paid emails the student that their payment is accepted and their seat
// confirmed. The Demo Class is free, so it has no payment status.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { paid?: unknown; teacher?: unknown } | null;
  const setsPaid = typeof body?.paid === "boolean";
  const setsTeacher = body?.teacher !== undefined;
  if (!body || (!setsPaid && !setsTeacher)) return new Response("Invalid request.", { status: 400 });
  if (setsTeacher && !isTeacher(body.teacher)) return new Response("Unknown teacher.", { status: 400 });

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, name, email, level, paid_at, teacher, booking_slots(kind, starts_at)")
    .eq("id", id)
    .maybeSingle();
  if (!booking) return new Response("Booking not found.", { status: 404 });
  const slot = booking.booking_slots as unknown as { kind: string; starts_at: string } | null;
  if (setsPaid && slot?.kind !== "orientation") return new Response("Demo classes are free — there's nothing to mark as paid.", { status: 400 });

  const update: Record<string, unknown> = {};
  if (setsTeacher) update.teacher = body.teacher;
  const paidAt = setsPaid ? (body.paid ? new Date().toISOString() : null) : booking.paid_at;
  if (setsPaid) update.paid_at = paidAt;

  const { error } = await supabase.from("bookings").update(update).eq("id", id);
  if (error) {
    console.error("Failed to update booking", id, error);
    return new Response("Couldn't update the booking.", { status: 500 });
  }

  // Only on the Unpaid -> Paid change, so pressing it twice doesn't email twice.
  let emailed = false;
  if (setsPaid && body.paid && !booking.paid_at && slot) {
    const when = formatSlotWhen(slot.starts_at);
    const level = (await readCatalog()).orientation.find((o) => o.level === booking.level);
    const teacher = (setsTeacher ? body.teacher : booking.teacher) as string | null;
    emailed = await sendBookingPaymentConfirmedEmail(booking.email, {
      name: booking.name,
      what: `French ${BOOKING_LABELS.orientation}`,
      when,
      details: [
        ...(level ? ([["Level", level.level], ["Test fee", formatRupees(level.priceInPaise)]] as [string, string][]) : []),
        ...(teacher ? ([["Teacher", teacher]] as [string, string][]) : []),
      ],
      whatsappUrl: whatsappUrl(`Hi Yana! I'm ${booking.name} (${booking.email}), confirmed for the Orientation Test on ${when}.`),
      whatsappNumber: whatsappDisplay,
    }).catch((err) => {
      console.error("Failed to send payment confirmation", booking.email, err);
      return false;
    });
  }
  return Response.json({ paidAt, teacher: update.teacher ?? booking.teacher, emailed });
}

// DELETE: Admin -> Bookings' Remove — cancels a booking and frees its seat.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete booking", id, error);
    return new Response("Couldn't remove the booking.", { status: 500 });
  }
  return Response.json({ ok: true });
}
