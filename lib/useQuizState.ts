"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultQuizLevel, type QuizLevel, type QuizSession } from "./quizData";

// A student's own quiz level + history (see lib/quizStore.ts) — replaces
// the quizLevel/quizSessions fields that used to live in the single
// shared lib/portalState.ts document. A single fetch on mount is enough:
// the only writers are /api/quiz/generate and /api/quiz/submit, both
// triggered by this same student in the same session — call `refresh`
// after either completes rather than polling.
export function useQuizState() {
  const [level, setLevel] = useState<QuizLevel>(defaultQuizLevel);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/quiz/state", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setLevel(data.level);
        setSessions(data.sessions);
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

  return { level, sessions, loaded, refresh };
}
