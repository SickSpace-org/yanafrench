import { google } from "@ai-sdk/google";
import { APICallError, RetryError, generateText } from "ai";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

// A short, deterministic-leaning generation like this tends to collapse to
// the same completion every call at low sampling variance — picking a
// random angle server-side and naming it in the prompt forces real variety
// instead of relying on the model's own randomness.
const ANGLES = ["confidence", "momentum", "courage", "consistency", "resilience", "energy", "focus", "progress", "curiosity", "grit"];

export async function POST() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];
    const { text } = await generateText({
      model: google("gemini-3.5-flash-lite"),
      system:
        "You write the 'Today's Note' shown on a French-learning student's dashboard. It must be purely " +
        "motivational — 3 to 4 words only, upbeat and punchy (e.g. \"Keep pushing forward!\", \"You've got this!\"). " +
        "No specific feedback, no observations, no names. Reply with ONLY the phrase, no quotes, no preamble.",
      prompt: `Write today's motivational note, themed around ${angle}.`,
    });

    return Response.json({ text: text.trim() });
  } catch (error) {
    const cause = RetryError.isInstance(error) ? error.lastError : error;
    if (APICallError.isInstance(cause) && cause.statusCode === 429) {
      return new Response("Rate limited — try again in a moment.", { status: 429 });
    }
    console.error(error);
    return new Response("Couldn't write a note right now.", { status: 500 });
  }
}
