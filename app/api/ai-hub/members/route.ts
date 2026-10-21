import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { AI_HUB_MEMBER_COLUMNS, memberFromRow, type AdminAiHubMember, type AiHubMemberRow } from "@/lib/aiHubData";

// GET: Admin -> Le Kiosque's list — newest request first.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const { data, error } = await supabase
    .from("ai_hub_members")
    .select(AI_HUB_MEMBER_COLUMNS)
    .order("requested_at", { ascending: false });
  if (error) {
    console.error("Failed to list Le Kiosque members", error);
    return new Response("Failed to load Le Kiosque members.", { status: 500 });
  }
  const members: AdminAiHubMember[] = ((data as AiHubMemberRow[]) ?? []).map(memberFromRow);
  return Response.json(members);
}
