// Small fetch helper shared by Le Kiosque tools: JSON in/out, and a readable
// message from the server's plain-text error body.

export async function aiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text && text.length < 200 ? text : "Something went wrong. Please try again.");
  }
  return res.json() as Promise<T>;
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return aiFetch<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

// Speak French with the browser's built-in voice (no API cost).
export function speakFrench(text: string, slow = false) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = slow ? 0.65 : 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("fr"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}
