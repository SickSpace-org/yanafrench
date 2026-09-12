// Server-only. Per-student quiz level + history, replacing the fields that
// used to live in the single shared lib/portalState.ts document. Kept
// separate from lib/quizData.ts (pure types/logic, also imported by the
// client) for the same reason lib/portalStateServer.ts is split out — this
// file's R2 dependency must never end up in a client bundle.

import { readJson, writeJson } from "./r2";
import { defaultQuizLevel, type QuizLevel, type QuizSession } from "./quizData";

export type QuizStore = {
  level: QuizLevel;
  sessions: QuizSession[];
};

const defaultQuizStore: QuizStore = { level: defaultQuizLevel, sessions: [] };

function quizKey(userId: string): string {
  return `data/quiz/${userId}.json`;
}

export async function getQuizStore(userId: string): Promise<QuizStore> {
  return { ...defaultQuizStore, ...(await readJson<QuizStore>(quizKey(userId), defaultQuizStore)) };
}

export async function setQuizLevelFor(userId: string, level: QuizLevel): Promise<boolean> {
  const store = await getQuizStore(userId);
  return writeJson(quizKey(userId), { ...store, level });
}

const MAX_HISTORY = 50;

export async function appendQuizSession(userId: string, session: QuizSession): Promise<QuizStore | null> {
  const store = await getQuizStore(userId);
  const next: QuizStore = { ...store, sessions: [session, ...store.sessions].slice(0, MAX_HISTORY) };
  const saved = await writeJson(quizKey(userId), next);
  return saved ? next : null;
}
