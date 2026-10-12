import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { DEFAULT_SLOT_CAPACITY, DEFAULT_TEACHER, isBookingKind, isTeacher, istToIso } from "@/lib/bookingData";
import { listAdminSlots } from "@/lib/bookings";

// Admin -> Bookings.
// GET ?kind=orientation|demo → every slot of that kind with its bookings
// POST { kind, date, time, capacity?, teacher? } → add a slot (date/time in IST)
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const kind = new URL(req.url).searchParams.get("kind");
  if (!isBookingKind(kind)) return new Response("Unknown booking type.", { status: 400 });
  try {
    return Response.json(await listAdminSlots(supabase, kind));
  } catch (err) {
    console.error("Failed to list admin booking slots", kind, err);
    return new Response("Couldn't load the slots.", { status: 502 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = (await req.json().catch(() => null)) as { kind?: unknown; date?: unknown; time?: unknown; capacity?: unknown; teacher?: unknown } | null;
  if (!body || !isBookingKind(body.kind)) return new Response("Unknown booking type.", { status: 400 });
  const startsAt = istToIso(String(body.date ?? ""), String(body.time ?? ""));
  if (!startsAt) return new Response("Pick a date and a time.", { status: 400 });
  const capacity = body.capacity === undefined ? DEFAULT_SLOT_CAPACITY : Number(body.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) return new Response("Seats must be between 1 and 50.", { status: 400 });

  const teacher = body.teacher === undefined ? DEFAULT_TEACHER : body.teacher;
  if (!isTeacher(teacher)) return new Response("Unknown teacher.", { status: 400 });

  const { data, error } = await supabase
    .from("booking_slots")
    .insert({ kind: body.kind, starts_at: startsAt, capacity, teacher })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return new Response("There's already a slot at that date and time.", { status: 409 });
    console.error("Failed to add booking slot", error);
    return new Response("Couldn't add the slot.", { status: 500 });
  }
  return Response.json({ id: data.id });
}
