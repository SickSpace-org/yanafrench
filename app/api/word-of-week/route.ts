import { google } from "@ai-sdk/google";
import { APICallError, RetryError, generateText, Output } from "ai";
import { z } from "zod";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

const wordSchema = z.object({
  word: z.string().describe("The French word or short phrase itself, exactly as it should be displayed"),
  meaning: z.string().describe('A short, gloss-style English meaning — a few words, not a sentence (e.g. "however · yet")'),
});

// Picking a random word type server-side and naming it in the prompt keeps
// results varied — left to its own sampling the model tends to collapse to
// the same word (or two) call after call.
const WORD_TYPES = ["connector", "idiom or fixed expression", "reflexive verb", "adjective", "adverb", "everyday noun", "phrasal expression"];

export async function POST() {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    const type = WORD_TYPES[Math.floor(Math.random() * WORD_TYPES.length)];
    const { output } = await generateText({
      model: google("gemini-3.5-flash-lite"),
      system:
        "You help a French teacher pick a 'Word of the Day' to show a French-learning student on their dashboard. " +
        "Keep the meaning short and gloss-style — a few words separated by · if there are multiple senses, never a full sentence.",
      prompt: `Pick one useful French ${type} worth an intermediate (B1/B2) learner knowing today, and give its short English meaning.`,
      output: Output.object({ schema: wordSchema }),
    });

    return Response.json(output);
  } catch (error) {
    const cause = RetryError.isInstance(error) ? error.lastError : error;
    if (APICallError.isInstance(cause) && cause.statusCode === 429) {
      return new Response("Rate limited — try again in a moment.", { status: 429 });
    }
    console.error(error);
    return new Response("Couldn't generate a word right now.", { status: 500 });
  }
}
