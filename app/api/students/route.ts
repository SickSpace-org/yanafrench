import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { studentFromRow, type StudentRow } from "@/lib/studentData";

// GET: the roster of confirmed, paying students for Admin → Students,
// newest first. Rows are only ever written by app/api/payment/verify on a
// successfully verified payment — no public POST here.
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const { data, error } = await supabase.from("students").select("*").order("enrolled_at", { ascending: false });
  if (error) {
    console.error("Failed to list students", error);
    return new Response("Failed to load students.", { status: 500 });
  }
  return Response.json((data as StudentRow[]).map(studentFromRow));
}
