import { evaluateSpeakingAudio, SpeakingEvalRateLimitError } from "@/lib/speakingEval";
import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { appendSpeakingAttempt } from "@/lib/speakingStore";
import type { SpeakingAttempt } from "@/lib/speakingData";

export async function POST(req: Request) {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    const formData = await req.formData();
    const audio = formData.get("audio");
    const prompt = formData.get("prompt");
    const topic = formData.get("topic");
    const durationLabel = formData.get("durationLabel");

    if (!(audio instanceof File) || typeof prompt !== "string" || !prompt) {
      return new Response("Missing audio or prompt", { status: 400 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const evaluation = await evaluateSpeakingAudio(prompt, buffer, audio.type || "audio/webm");

    // Persisted here, server-side, driven only by the server's own
    // evaluation result — the client can no longer fabricate a fake score
    // for its own history (the old localStorage-based saveAttempt() let
    // it construct and save any SpeakingAttempt it liked).
    const attempt: SpeakingAttempt = {
      id: `attempt-${Date.now()}`,
      date: new Date().toISOString(),
      topic: typeof topic === "string" && topic ? topic : "Practice",
      prompt,
      durationLabel: typeof durationLabel === "string" ? durationLabel : "",
      status: "Reviewed",
      evaluation,
    };
    await appendSpeakingAttempt(viewer.userId, attempt);

    return Response.json(attempt);
  } catch (error) {
    if (error instanceof SpeakingEvalRateLimitError) {
      return new Response("Rate limited", { status: 429 });
    }
    console.error(error);
    return new Response("Evaluation failed", { status: 500 });
  }
}
