import { authErrorResponse } from "@/lib/auth";
import { aiLimit, requireAiMember } from "@/lib/aiHub";
import { AiRateLimitError, generatePhrase } from "@/lib/aiHubAi";
import { isAiHubLevel } from "@/lib/aiHubData";

// POST { level, topic? }: a fresh French sentence to practise, with its
// translation and a tip on the trickiest sound.
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await requireAiMember()).userId;
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  if (!isAiHubLevel(body?.level)) return new Response("Choose a level.", { status: 400 });
  const topic = typeof body?.topic === "string" ? body.topic.trim().slice(0, 80) : "";

  if (!(await aiLimit(userId, "phrase", 100))) {
    return new Response("You've reached today's limit — it resets tomorrow.", { status: 429 });
  }

  try {
    return Response.json(await generatePhrase(body.level, topic));
  } catch (err) {
    if (err instanceof AiRateLimitError) return new Response("The AI is busy — try again in a minute.", { status: 429 });
    console.error("Le Kiosque phrase generation failed", err);
    return new Response("Couldn't get a phrase. Please try again.", { status: 500 });
  }
}
