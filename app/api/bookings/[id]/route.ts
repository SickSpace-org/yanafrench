import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { BOOKING_LABELS, formatSlotWhen } from "@/lib/bookingData";
import { orientationLevels } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";
import { sendBookingPaymentConfirmedEmail } from "@/lib/email";
import { whatsappDisplay, whatsappUrl } from "@/lib/site";

// PATCH { paid: boolean } — Admin -> Bookings moves an Orientation Test
// booking between Unpaid and Paid; moving it to Paid emails the student
// that their payment is accepted and their seat confirmed. The Demo Class
// is free, so it has no payment status.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { paid?: unknown } | null;
  if (typeof body?.paid !== "boolean") return new Response("Invalid request.", { status: 400 });

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, name, email, level, paid_at, booking_slots(kind, starts_at)")
    .eq("id", id)
    .maybeSingle();
  if (!booking) return new Response("Booking not found.", { status: 404 });
  const slot = booking.booking_slots as unknown as { kind: string; starts_at: string } | null;
  if (slot?.kind !== "orientation") return new Response("Demo classes are free — there's nothing to mark as paid.", { status: 400 });

  const paidAt = body.paid ? new Date().toISOString() : null;
  const { error } = await supabase.from("bookings").update({ paid_at: paidAt }).eq("id", id);
  if (error) {
    console.error("Failed to update booking payment", id, error);
    return new Response("Couldn't update the payment status.", { status: 500 });
  }

  // Only on the Unpaid -> Paid change, so pressing it twice doesn't email twice.
  let emailed = false;
  if (body.paid && !booking.paid_at) {
    const when = formatSlotWhen(slot.starts_at);
    const level = orientationLevels.find((o) => o.level === booking.level);
    emailed = await sendBookingPaymentConfirmedEmail(booking.email, {
      name: booking.name,
      what: `French ${BOOKING_LABELS.orientation}`,
      when,
      details: level ? [["Level", level.level], ["Test fee", formatRupees(level.priceInPaise)]] : [],
      whatsappUrl: whatsappUrl(`Hi Yana! I'm ${booking.name} (${booking.email}), confirmed for the Orientation Test on ${when}.`),
      whatsappNumber: whatsappDisplay,
    }).catch((err) => {
      console.error("Failed to send payment confirmation", booking.email, err);
      return false;
    });
  }
  return Response.json({ paidAt, emailed });
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
