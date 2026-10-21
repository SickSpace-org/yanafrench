import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse } from "@/lib/auth";
import { requireAiMember } from "@/lib/aiHub";
import type { PronunciationAttempt, PronunciationEvaluation } from "@/lib/aiHubData";

// GET: the member's 20 most recent pronunciation attempts.
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAiMember()).userId;
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const { data, error } = await supabase
    .from("ai_hub_pronunciations")
    .select("id, phrase, evaluation, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("Failed to load pronunciation history", error);
    return new Response("Couldn't load your history.", { status: 500 });
  }
  const attempts: PronunciationAttempt[] = (data ?? []).map((r) => ({
    id: r.id as string,
    phrase: r.phrase as string,
    evaluation: r.evaluation as PronunciationEvaluation,
    createdAt: r.created_at as string,
  }));
  return Response.json(attempts);
}
