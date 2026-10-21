import { authErrorResponse } from "@/lib/auth";
import { aiLimit, requireAiMember } from "@/lib/aiHub";
import { AiRateLimitError, translateText } from "@/lib/aiHubAi";

const MAX_CHARS = 800;

// POST { text }: AI French<->English translation with notes, examples and
// key words the member can save to their library.
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await requireAiMember()).userId;
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return new Response("Enter some text to translate.", { status: 400 });
  if (text.length > MAX_CHARS) return new Response(`Keep it under ${MAX_CHARS} characters.`, { status: 400 });

  if (!(await aiLimit(userId, "translate", 80))) {
    return new Response("You've reached today's translation limit — it resets tomorrow.", { status: 429 });
  }

  try {
    return Response.json(await translateText(text));
  } catch (err) {
    if (err instanceof AiRateLimitError) return new Response("The AI is busy — try again in a minute.", { status: 429 });
    console.error("Le Kiosque translation failed", err);
    return new Response("Couldn't translate that. Please try again.", { status: 500 });
  }
}
