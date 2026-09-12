// Data layer for the Speaking Practice feature.
//
// evaluateAttempt() calls /api/speaking/evaluate, which sends the recorded
// audio directly to Gemini (audio -> AI analysis -> scores -> corrections ->
// feedback, in one multimodal call), persists the result server-side keyed
// by the student's own account (see lib/speakingStore.ts), and returns the
// saved attempt. History is fetched via lib/useSpeakingHistory.ts, not
// read from this file — there's no longer a client-side store here.

export type SkillScores = {
  pronunciation: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  sentenceStructure: number;
  coherence: number;
};

export type Correction = { said: string; better: string; explanation: string };

export type SpeakingEvaluation = {
  transcript: string;
  overall: number;
  scores: SkillScores;
  wellDone: string;
  improve: string;
  corrections: Correction[];
  improvedAnswer: string;
};

export type SpeakingAttempt = {
  id: string;
  date: string; // ISO timestamp
  topic: string;
  prompt: string;
  durationLabel: string;
  status: "Reviewed";
  evaluation: SpeakingEvaluation;
};

export const prompts = [
  { topic: "Personal experience", text: "Parlez-moi d'une expérience qui vous a beaucoup appris." },
  { topic: "Travel", text: "Décrivez un voyage qui vous a marqué et expliquez pourquoi." },
  { topic: "Opinion", text: "Pensez-vous que la technologie a changé notre façon d'apprendre ? Pourquoi ?" },
];

export function formatAttemptDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export async function evaluateAttempt(
  audio: Blob,
  promptText: string,
  topic: string,
  durationLabel: string
): Promise<SpeakingAttempt> {
  const formData = new FormData();
  formData.append("audio", audio, "attempt.webm");
  formData.append("prompt", promptText);
  formData.append("topic", topic);
  formData.append("durationLabel", durationLabel);

  const res = await fetch("/api/speaking/evaluate", { method: "POST", body: formData });
  if (!res.ok) {
    throw new Error(res.status === 429 ? "RATE_LIMITED" : "EVALUATION_FAILED");
  }
  return res.json();
}
