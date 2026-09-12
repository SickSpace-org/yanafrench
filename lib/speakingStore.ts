// Server-only. Per-student speaking-practice history — replaces
// lib/speakingData.ts's localStorage persistence (per-browser, invisible
// to the admin, and trivially fabricable client-side) with a real
// server-side record keyed by the student's Supabase Auth user id,
// written only by app/api/speaking/evaluate from the server's own
// evaluation result.

import { readJson, writeJson } from "./r2";
import type { SpeakingAttempt } from "./speakingData";

const MAX_HISTORY = 50;

function speakingKey(userId: string): string {
  return `data/speaking-history/${userId}.json`;
}

export async function getSpeakingHistoryFor(userId: string): Promise<SpeakingAttempt[]> {
  return readJson<SpeakingAttempt[]>(speakingKey(userId), []);
}

export async function appendSpeakingAttempt(userId: string, attempt: SpeakingAttempt): Promise<boolean> {
  const existing = await getSpeakingHistoryFor(userId);
  const next = [attempt, ...existing].slice(0, MAX_HISTORY);
  return writeJson(speakingKey(userId), next);
}
