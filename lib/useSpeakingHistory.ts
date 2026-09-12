"use client";

import { useCallback, useEffect, useState } from "react";
import type { SpeakingAttempt } from "./speakingData";

// A student's own speaking-practice history (see lib/speakingStore.ts) —
// replaces the old localStorage read. Single fetch on mount; call
// `refresh` after a new attempt is submitted from the same session.
export function useSpeakingHistory() {
  const [history, setHistory] = useState<SpeakingAttempt[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/speaking/history", { cache: "no-store" });
      if (res.ok) setHistory(await res.json());
    } catch {
      // stay on last-known history if a fetch fails
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { history, loaded, refresh };
}
