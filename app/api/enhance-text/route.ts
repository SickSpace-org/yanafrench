import { google } from "@ai-sdk/google";
import { APICallError, RetryError, generateText } from "ai";
import { authErrorResponse, requireAdmin } from "@/lib/auth";

const KIND_GUIDANCE: Record<string, string> = {
  title: "Rewrite this as a short, clear, appealing title. One line, no trailing period, no quotes.",
  description: "Rewrite this as a clear, well-structured description (2-4 sentences). Fix grammar and awkward phrasing, tighten the wording, and make it sound professional and inviting — without inventing facts that aren't in the original.",
};

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    const body = await req.json().catch(() => null);
    const kind = typeof body?.kind === "string" ? body.kind : "description";
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const context = typeof body?.context === "string" ? body.context : "";

    if (!text) {
      return new Response("Nothing to enhance yet — write a draft first.", { status: 400 });
    }

    const guidance = KIND_GUIDANCE[kind] ?? KIND_GUIDANCE.description;

    const { text: enhanced } = await generateText({
      model: google("gemini-3.5-flash-lite"),
      system:
        "You help an admin at a French-language teaching platform (Le Hub) polish the copy they write for students — " +
        "course titles/descriptions, recordings, resources, and homework assignments. " +
        "Keep the original language the text was written in (English, unless the admin wrote it in French). " +
        "Preserve every concrete fact (names, numbers, deadlines, topics) exactly. " +
        "Reply with ONLY the rewritten text — no preamble, no quotes, no explanation.",
      messages: [
        {
          role: "user",
          content: `${guidance}${context ? `\n\nContext: ${context}` : ""}\n\nOriginal text:\n${text}`,
        },
      ],
    });

    return Response.json({ enhanced: enhanced.trim() });
  } catch (error) {
    const cause = RetryError.isInstance(error) ? error.lastError : error;
    if (APICallError.isInstance(cause) && cause.statusCode === 429) {
      return new Response("Rate limited — try again in a moment.", { status: 429 });
    }
    console.error(error);
    return new Response("Enhancement failed. Please try again.", { status: 500 });
  }
}
