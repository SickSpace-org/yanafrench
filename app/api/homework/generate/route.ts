import { google } from "@ai-sdk/google";
import { APICallError, RetryError, generateText, Output } from "ai";
import { z } from "zod";
import { authErrorResponse, requireAdmin, type Viewer } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { cleanHomeworkDraft } from "@/lib/homeworkData";

// Admin → Homework's "Make homework with AI": either writes the homework the
// admin asks for ("10 fill-in-the-blanks on the passé composé, A2") exactly
// as described, or turns pasted rough notes into a clean, student-facing
// assignment without losing any of their content. Flat schema, same
// reasoning as app/api/quiz/generate.
const homeworkSchema = z.object({
  title: z.string().describe("A short, clear homework title, e.g. \"Homework — Le passé composé\". No trailing period."),
  intro: z
    .string()
    .describe("1-2 friendly sentences telling the student what this homework practises and what to hand in. Empty string if nothing fits."),
  sections: z
    .array(
      z.object({
        heading: z.string().describe("Section heading, e.g. \"Exercise 1 — Conjugate the verbs\" or \"Writing\""),
        tasks: z
          .array(z.string())
          .describe("The individual numbered items or instructions in this section, one per entry, without their own numbering"),
      })
    )
    .describe("The homework split into logical exercises, in the order the admin gave them"),
});

export async function POST(req: Request) {
  let viewer: Viewer;
  try {
    viewer = await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const allowed = await checkRateLimit(`homework-generate:${viewer.userId}`, 20, 600);
  if (!allowed) return rateLimitResponse();

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return new Response("Describe the homework or paste it first.", { status: 400 });
  if (text.length > 12_000) return new Response("That's too long — keep it under 12,000 characters.", { status: 400 });

  try {
    const { output } = await generateText({
      model: google("gemini-3.5-flash-lite"),
      system:
        "You are the teaching assistant at Le Hub, a French-language school. The teacher gives you either a REQUEST describing " +
        "the homework they want, or their own rough homework notes (or a mix of both). You produce a polished homework sheet. " +
        "If the teacher describes what they want (e.g. \"10 fill-in-the-blank sentences on the passé composé for A2\", " +
        "\"a short reading passage with 5 comprehension questions\", \"matching vocab about food\"), WRITE that homework yourself, " +
        "following their instructions exactly: the same exercise type, number of questions, topic, grammar point, level and any " +
        "format details they ask for — never swap in a different kind of exercise or add exercises they didn't ask for. " +
        "Write correct, natural French pitched at the level they name (A1 simple if none is given). " +
        "If the teacher pastes their own exercises, keep EVERY exercise, question, sentence, word list and deadline — never drop, " +
        "merge away or replace their content — and keep French content (sentences to translate, verbs, dialogues, blanks like ___) " +
        "exactly in French, correcting only obvious typos. " +
        "Fill-in-the-blank items use ___ for each blank; multiple-choice items list the options inside the task, e.g. \"Je ___ au cinéma. (a) vais (b) va (c) allons\"; " +
        "a reading passage goes as the first task of its section, followed by the questions. Never include the answers. " +
        "Write headings and instructions in clear, encouraging English unless the teacher wrote in French or asks for French. " +
        "Group items into sensible exercises with clear instructions, and put each question or item as its own task. " +
        "Follow the response schema's field names exactly.",
      prompt: `Teacher's homework notes:\n\n${text}`,
      output: Output.object({ schema: homeworkSchema }),
    });

    const draft = cleanHomeworkDraft(output);
    if (!draft) return new Response("The AI couldn't make homework from that — try adding a bit more detail.", { status: 422 });
    return Response.json({ homework: draft });
  } catch (error) {
    const cause = RetryError.isInstance(error) ? error.lastError : error;
    if (APICallError.isInstance(cause) && cause.statusCode === 429) {
      return new Response("Rate limited — try again in a moment.", { status: 429 });
    }
    console.error(error);
    return new Response("Couldn't make the homework. Please try again.", { status: 500 });
  }
}
