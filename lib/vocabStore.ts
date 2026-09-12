// Server-only. Per-student saved vocabulary words + favorites — replaces
// lib/vocabData.ts's two localStorage keys (per-browser, invisible across
// devices) with a real server-side record keyed by the student's
// Supabase Auth user id.

import { readJson, writeJson } from "./r2";
import type { VocabWord } from "./vocabData";

export type VocabStore = {
  savedWords: VocabWord[];
  favoriteIds: string[];
};

const defaultVocabStore: VocabStore = { savedWords: [], favoriteIds: [] };

function vocabKey(userId: string): string {
  return `data/vocab/${userId}.json`;
}

export async function getVocabStore(userId: string): Promise<VocabStore> {
  return { ...defaultVocabStore, ...(await readJson<VocabStore>(vocabKey(userId), defaultVocabStore)) };
}

export async function saveWordFor(userId: string, word: VocabWord): Promise<VocabStore | null> {
  const store = await getVocabStore(userId);
  const next: VocabStore = { ...store, savedWords: [word, ...store.savedWords.filter((w) => w.id !== word.id)] };
  const saved = await writeJson(vocabKey(userId), next);
  return saved ? next : null;
}

export async function toggleFavoriteFor(userId: string, id: string): Promise<VocabStore | null> {
  const store = await getVocabStore(userId);
  const has = store.favoriteIds.includes(id);
  const next: VocabStore = {
    ...store,
    favoriteIds: has ? store.favoriteIds.filter((f) => f !== id) : [...store.favoriteIds, id],
  };
  const saved = await writeJson(vocabKey(userId), next);
  return saved ? next : null;
}
