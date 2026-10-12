import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isBookingKind } from "@/lib/bookingData";
import { listPublicSlots } from "@/lib/bookings";

// GET ?kind=orientation|demo — public. Upcoming open slots and how many
// seats each has left; polled by the booking modal so a slot that fills up
// while someone is choosing shows as Full.
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isBookingKind(kind)) return new Response("Unknown booking type.", { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  try {
    const slots = await listPublicSlots(supabase, kind);
    return Response.json(slots, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Failed to list booking slots", kind, err);
    return new Response("Couldn't load the time slots.", { status: 502 });
  }
}
