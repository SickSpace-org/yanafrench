import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BOOKING_IS_PAID, BOOKING_LABELS, formatSlotWhen, isBookingKind } from "@/lib/bookingData";
import { bookSlot, type BookSlotFailure } from "@/lib/bookings";
import { orientationLevels } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rateLimit";
import { whatsappDisplay, whatsappUrl } from "@/lib/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FAILURE_RESPONSES: Record<BookSlotFailure, [number, string]> = {
  slot_not_found: [404, "That time slot no longer exists. Please pick another one."],
  slot_closed: [409, "That time slot is no longer available. Please pick another one."],
  slot_past: [409, "That time slot has already passed. Please pick another one."],
  slot_full: [409, "Sorry, that time slot just filled up. Please pick another one."],
  already_booked: [409, "You've already booked this time slot with this email."],
};

type Body = { kind?: unknown; slotId?: unknown; name?: unknown; email?: unknown; phone?: unknown; level?: unknown; message?: unknown };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// POST — public: book a seat in an Orientation Test or Demo Class slot,
// then email the student (asking them to pay the fee to confirm, for the
// Orientation Test). The seat is saved even if the email can't be sent.
export async function POST(req: Request) {
  if (!(await checkRateLimit(`booking:${clientIp(req)}`, 10, 600))) return rateLimitResponse();

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = ((await req.json().catch(() => null)) ?? {}) as Body;
  const kind = body.kind;
  const slotId = str(body.slotId);
  const name = str(body.name).slice(0, 120);
  const email = str(body.email).slice(0, 200);
  const phone = str(body.phone).slice(0, 40);
  const message = str(body.message).slice(0, 1000) || null;

  if (!isBookingKind(kind)) return new Response("Unknown booking type.", { status: 400 });
  if (!UUID_RE.test(slotId)) return new Response("Please pick a time slot.", { status: 400 });
  if (!name || !phone || !EMAIL_RE.test(email)) return new Response("Please fill in your name, email and phone.", { status: 400 });

  // The Orientation Test is taken at a level, with that level's fee.
  const orientation = kind === "orientation" ? orientationLevels.find((o) => o.level === str(body.level)) : undefined;
  if (kind === "orientation" && !orientation) return new Response("Please pick a test level.", { status: 400 });
  const level = orientation?.level ?? (str(body.level).slice(0, 40) || null);

  // The slot must belong to the kind being booked — the two never share seats.
  const { data: slotKind } = await supabase.from("booking_slots").select("kind").eq("id", slotId).maybeSingle();
  if (!slotKind) return new Response(FAILURE_RESPONSES.slot_not_found[1], { status: 404 });
  if (slotKind.kind !== kind) return new Response("That time slot is for a different booking.", { status: 400 });

  const result = await bookSlot(supabase, { slotId, name, email, phone, level, message });
  if (!result.ok) {
    if (result.reason === "error") return new Response("Couldn't save your booking. Please try again.", { status: 502 });
    const [status, text] = FAILURE_RESPONSES[result.reason];
    return new Response(text, { status });
  }

  const what = BOOKING_LABELS[kind];
  const when = formatSlotWhen(result.slot.starts_at);
  const details: [string, string][] = orientation
    ? [["Level", orientation.level], ["Test fee", formatRupees(orientation.priceInPaise)]]
    : level
      ? [["Current level", level]]
      : [];

  const paymentRequired = BOOKING_IS_PAID[kind];
  await sendBookingConfirmationEmail(email, {
    name,
    what,
    when,
    details,
    paymentRequired,
    whatsappUrl: whatsappUrl(
      paymentRequired
        ? `Hi Yana! I'm ${name} (${email}). I've booked the French Orientation Test — ${level} for ${when}. Please share the details for payment.`
        : `Hi Yana! I'm ${name} (${email}). I've booked the free Demo Class for ${when}.`
    ),
    whatsappNumber: whatsappDisplay,
  }).catch((err) => console.error("Failed to send booking confirmation", email, err));

  return Response.json({ bookingId: result.bookingId, startsAt: new Date(result.slot.starts_at).toISOString() });
}
