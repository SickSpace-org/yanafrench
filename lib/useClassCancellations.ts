"use client";

import { useEffect, useState } from "react";
import { cancellationKey, type ClassCancellation } from "./attendanceData";

// The signed-in student's cancelled classes from today on
// (app/api/student/class-cancellations), keyed by cancellationKey.
export function useClassCancellations(): Map<string, ClassCancellation> {
  const [cancellations, setCancellations] = useState<Map<string, ClassCancellation>>(new Map());
  useEffect(() => {
    fetch("/api/student/class-cancellations", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { cancellations?: ClassCancellation[] } | null) => {
        if (data?.cancellations) setCancellations(new Map(data.cancellations.map((c) => [cancellationKey(c.batchId, c.date), c])));
      })
      .catch(() => {});
  }, []);
  return cancellations;
}

// The YYYY-MM-DD of a class event's date — generateClassEvents
// (lib/batchData.ts) builds them at local midnight, so read it back locally.
export function classDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
