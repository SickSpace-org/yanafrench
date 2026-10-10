"use client";

import { useMemo } from "react";
import { useAdminCollection } from "./useAdminCollection";
import type { AdminTeacher } from "./teacherData";

// Admin-only: batch id -> the name of the teacher who runs it (from
// app/api/teachers). teacherFor() falls back to "Yana (admin)" for a batch
// with no teacher, matching the rule that unassigned batches stay with her
// (same wording as the assignment dropdown on Admin -> Teachers). Display
// text only — nothing compares against it.
export const ADMIN_BATCH_LABEL = "Yana (admin)";

export function useBatchTeacherNames() {
  const { items: teachers, loaded } = useAdminCollection<AdminTeacher>("/api/teachers");
  const byBatch = useMemo(() => {
    const map = new Map<string, { name: string; paused: boolean }>();
    for (const t of teachers) for (const id of t.batchIds) map.set(id, { name: t.fullName, paused: t.status !== "active" });
    return map;
  }, [teachers]);

  function teacherFor(batchId: string): string {
    const t = byBatch.get(batchId);
    if (!t) return ADMIN_BATCH_LABEL;
    return t.paused ? `${t.name} (paused)` : t.name;
  }

  return { loaded, teacherFor };
}
