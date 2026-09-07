"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 3000;

// Shared polling shape for the three Supabase-backed admin collections
// (leads, payments, students) — same pattern as usePortalState/
// useMessageThread, just without an optimistic-write path since admin
// removal is the only mutation any of these three need right now.
export function useAdminCollection<T>(endpoint: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.ok) setItems(await res.json());
    } catch {
      // stay on last-known list if a poll fails
    } finally {
      setLoaded(true);
    }
  }, [endpoint]);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((item) => (item as { id: string }).id !== id));
    try {
      await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    } catch {
      // next poll will restore it if the delete didn't actually go through
    }
  }, [endpoint]);

  return { items, loaded, remove, refresh };
}
