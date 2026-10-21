import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse } from "@/lib/auth";
import { aiLimit, requireAiMember } from "@/lib/aiHub";
import { AiRateLimitError, evaluatePronunciation } from "@/lib/aiHubAi";
import { AI_HUB_LEVELS, type AiHubLevel, type PronunciationAttempt } from "@/lib/aiHubData";

const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

// POST (multipart: audio, phrase): scores a recording of the member reading
// the target sentence aloud, saves the attempt, and returns it.
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await requireAiMember()).userId;
  } catch (err) {
    return authErrorResponse(err);
  }

  if (!(await aiLimit(userId, "pronunciation", 40))) {
    return new Response("You've reached today's pronunciation limit — it resets tomorrow.", { status: 429 });
  }

  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const phrase = form.get("phrase");
    if (!(audio instanceof File) || typeof phrase !== "string" || !phrase.trim()) {
      return new Response("Missing audio or phrase.", { status: 400 });
    }
    if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      return new Response("The recording is empty or too long — keep it under two minutes.", { status: 400 });
    }

    const monologue = form.get("mode") === "monologue";
    const levelField = form.get("level");
    const level = (AI_HUB_LEVELS as readonly string[]).includes(String(levelField)) ? (levelField as AiHubLevel) : undefined;
    const evaluation = await evaluatePronunciation(phrase.trim().slice(0, 1200), Buffer.from(await audio.arrayBuffer()), audio.type || "audio/webm", level, monologue);

    const attempt: PronunciationAttempt = {
      id: `pron-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      phrase: (monologue ? "Monologue: " : "") + phrase.trim().slice(0, 1200),
      evaluation,
      createdAt: new Date().toISOString(),
    };
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase
        .from("ai_hub_pronunciations")
        .insert({ id: attempt.id, user_id: userId, phrase: attempt.phrase, evaluation, created_at: attempt.createdAt });
      if (error) console.error("Failed to save pronunciation attempt", error);
    }
    return Response.json(attempt);
  } catch (err) {
    if (err instanceof AiRateLimitError) return new Response("The AI is busy — try again in a minute.", { status: 429 });
    console.error("Le Kiosque pronunciation evaluation failed", err);
    return new Response("Couldn't evaluate that recording. Please try again.", { status: 500 });
  }
}
