import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { leadFromRow, leadToRow, type Lead, type LeadRow } from "@/lib/leadData";

// GET: list every enrollment inquiry for Admin → Enrollments, newest first.
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to list leads", error);
    return new Response("Failed to load leads.", { status: 500 });
  }
  return Response.json((data as LeadRow[]).map(leadFromRow));
}

// POST: the enroll form (see components/BatchFinder.tsx) creates the lead
// client-side (id generated there) and fires this — the id is generated on
// the client rather than here so EnrollModal has it immediately to kick
// off the Razorpay payment step without waiting on this round trip.
export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const lead = (await req.json().catch(() => null)) as Lead | null;
  if (!lead || !lead.id || !lead.name || !lead.email || !lead.phone) {
    return new Response("Invalid lead.", { status: 400 });
  }

  const { error } = await supabase.from("leads").insert(leadToRow(lead));
  if (error) {
    console.error("Failed to insert lead", error);
    return new Response("Failed to save lead.", { status: 500 });
  }
  return Response.json({ ok: true });
}
