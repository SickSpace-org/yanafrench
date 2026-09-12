// Server-only. Per-student message thread — replaces the single shared
// data/messages.json document with one document per student, keyed by
// their Supabase Auth user id.

import { readJson, writeJson } from "./r2";

export type ThreadMessage = { id: string; from: "student" | "teacher"; text: string; time: number };

function messagesKey(userId: string): string {
  return `data/messages/${userId}.json`;
}

export async function getMessagesFor(userId: string): Promise<ThreadMessage[]> {
  return readJson<ThreadMessage[]>(messagesKey(userId), []);
}

export async function appendMessageFor(userId: string, message: ThreadMessage): Promise<ThreadMessage[] | null> {
  const existing = await getMessagesFor(userId);
  const next = [...existing, message];
  const saved = await writeJson(messagesKey(userId), next);
  return saved ? next : null;
}
