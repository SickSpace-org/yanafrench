"use client";

import { useEffect, useState } from "react";
import type { EmiSettings } from "./emiData";

// Admin → EMI Plans' settings for the course page's checkout, fetched once
// per page load and shared by every enroll modal. null until loaded (or if
// the fetch fails, in which case resolveEmiPlan falls back to the defaults
// and the server still charges the real plan).
let cached: Promise<EmiSettings | null> | null = null;

export function prefetchEmiSettings(): Promise<EmiSettings | null> {
  cached ??= fetch("/api/emi-settings", { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<EmiSettings>) : null))
    .catch(() => null)
    .then((settings) => {
      if (!settings) cached = null; // let the next modal retry
      return settings;
    });
  return cached;
}

export function useEmiSettings(): { settings: EmiSettings; loaded: boolean } {
  const [settings, setSettings] = useState<EmiSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    prefetchEmiSettings().then((s) => {
      if (!alive) return;
      setSettings(s);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { settings: settings ?? {}, loaded };
}
