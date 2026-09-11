import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { paymentFromRow, type PaymentRow } from "@/lib/paymentData";

// GET: every Razorpay checkout attempt for Admin → Payments, newest first.
// Rows are only ever written by app/api/payment/create-order (insert) and
// app/api/payment/verify (status update) — no public POST here.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const { data, error } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to list payments", error);
    return new Response("Failed to load payments.", { status: 500 });
  }
  return Response.json((data as PaymentRow[]).map(paymentFromRow));
}
