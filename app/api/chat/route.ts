import { google } from "@ai-sdk/google";
import {
  APICallError,
  RetryError,
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import { programmes, resources, resourcePathways } from "@/lib/data";
import { checkRateLimit, rateLimitResponse, clientIp } from "@/lib/rateLimit";

const SYSTEM_PROMPT = `You are the assistant on The Français Hub website — Yana's French coaching business (TEF/TCF exam prep, DELF A1-B2 certification, and general French learning).

Answer only using the information below. Keep replies short (2-4 sentences), warm, and specific. If someone asks something you can't answer from this context (exact scheduling, personal feedback on their level, payment issues), tell them to message Yana directly on WhatsApp — don't guess.

PROGRAMMES:
${programmes.map((p) => `- ${p.title} (${p.kicker}): ${p.subtitle}`).join("\n")}

RESOURCE PATHWAYS:
${resourcePathways.map((r) => `- ${r.title}: ${r.body}`).join("\n")}

DIGITAL RESOURCES FOR SALE:
${resources.map((r) => `- ${r.title} [${r.category}, ${r.level}, ${r.price}]: ${r.body}`).join("\n")}

Never invent prices, scores, or programme details that aren't listed above.`;

export async function POST(req: Request) {
  const allowed = await checkRateLimit(`chat:${clientIp(req)}`, 20, 600);
  if (!allowed) return rateLimitResponse();

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-3.5-flash-lite"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        const cause = RetryError.isInstance(error) ? error.lastError : error;
        if (APICallError.isInstance(cause) && cause.statusCode === 429) {
          return "RATE_LIMITED";
        }
        console.error(error);
        return "An error occurred. Please try again in a moment.";
      },
    }),
  });
}
