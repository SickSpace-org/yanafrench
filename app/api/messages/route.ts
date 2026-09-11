import { readJson, writeJson } from "@/lib/r2";
import { authErrorResponse, requireStudent } from "@/lib/auth";

// Shared message thread between the student and admin Messages pages,
// persisted in R2 so both sides see the same conversation regardless of
// device or browser — localStorage can't do that since it's per-browser.

export type ThreadMessage = { id: string; from: "student" | "teacher"; text: string; time: number };

const MESSAGES_KEY = "data/messages.json";

const seedMessages: ThreadMessage[] = [
  { id: "m1", from: "teacher", text: "Bonjour Amelia ! I left a voice note on your last recording — your rhythm is really improving.", time: Date.now() - 1000 * 60 * 60 * 26 },
  { id: "m2", from: "student", text: "Thank you! I'll listen to it before our next class.", time: Date.now() - 1000 * 60 * 60 * 24 },
  { id: "m3", from: "teacher", text: "Perfect. Also, don't forget Lesson 13 is up — it builds directly on what we covered Thursday.", time: Date.now() - 1000 * 60 * 60 * 23 },
  { id: "m4", from: "teacher", text: "Thursday 9:30 AM as usual — see you then!", time: Date.now() - 1000 * 60 * 60 * 4 },
];

export async function GET() {
  try {
    await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  const messages = await readJson<ThreadMessage[]>(MESSAGES_KEY, seedMessages);
  return Response.json(messages);
}

export async function POST(req: Request) {
  try {
    await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  const from = body?.from;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if ((from !== "student" && from !== "teacher") || !text) {
    return new Response("Invalid message", { status: 400 });
  }

  const existing = await readJson<ThreadMessage[]>(MESSAGES_KEY, seedMessages);
  const message: ThreadMessage = { id: `msg-${Date.now()}`, from, text, time: Date.now() };
  const next = [...existing, message];

  const saved = await writeJson(MESSAGES_KEY, next);
  if (!saved) {
    return new Response("Messages aren't persisted yet — R2 isn't configured.", { status: 501 });
  }

  return Response.json(next);
}
