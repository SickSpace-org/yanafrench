import { evaluateSpeakingAudio, SpeakingEvalRateLimitError } from "@/lib/speakingEval";
import { authErrorResponse, requireStudent } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    const formData = await req.formData();
    const audio = formData.get("audio");
    const prompt = formData.get("prompt");

    if (!(audio instanceof File) || typeof prompt !== "string" || !prompt) {
      return new Response("Missing audio or prompt", { status: 400 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const output = await evaluateSpeakingAudio(prompt, buffer, audio.type || "audio/webm");

    return Response.json(output);
  } catch (error) {
    if (error instanceof SpeakingEvalRateLimitError) {
      return new Response("Rate limited", { status: 429 });
    }
    console.error(error);
    return new Response("Evaluation failed", { status: 500 });
  }
}
