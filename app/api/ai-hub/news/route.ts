import { authErrorResponse } from "@/lib/auth";
import { aiHubToday, requireAiMember } from "@/lib/aiHub";
import { AiRateLimitError } from "@/lib/aiHubAi";
import { getOrCreateNews } from "@/lib/aiHubNews";

// News generation does a web search plus a write-up, so allow it time if a
// member is the first one in on a day the cron hasn't run.
export const maxDuration = 120;

// GET: today's three graded French articles (A2 / B1 / B2).
export async function GET() {
  try {
    await requireAiMember();
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    return Response.json(await getOrCreateNews(aiHubToday()));
  } catch (err) {
    if (err instanceof AiRateLimitError) return new Response("The AI is busy — try again in a minute.", { status: 429 });
    console.error("Le Kiosque news failed", err);
    return new Response("Today's news isn't ready yet. Please try again shortly.", { status: 500 });
  }
}
