"use client";

import { useCallback, useEffect, useState } from "react";
import type { VocabWord } from "./vocabData";

// A student's own saved words + favorites (see lib/vocabStore.ts) —
// replaces the old per-browser localStorage version.
export function useVocabState() {
  const [savedWords, setSavedWords] = useState<VocabWord[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/vocab", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSavedWords(data.savedWords);
        setFavoriteIds(data.favoriteIds);
      }
    } catch {
      // stay on last-known state if a fetch fails
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveWord = useCallback(async (word: VocabWord) => {
    setSavedWords((prev) => [word, ...prev.filter((w) => w.id !== word.id)]);
    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "saveWord", word }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedWords(data.savedWords);
        setFavoriteIds(data.favoriteIds);
      }
    } catch {
      // optimistic update stays; next refresh reconciles
    }
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "toggleFavorite", id }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedWords(data.savedWords);
        setFavoriteIds(data.favoriteIds);
      }
    } catch {
      // optimistic update stays; next refresh reconciles
    }
  }, []);

  return { savedWords, favoriteIds, loaded, saveWord, toggleFavorite };
}
