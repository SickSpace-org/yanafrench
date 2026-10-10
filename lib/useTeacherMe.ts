"use client";

import { useEffect, useState } from "react";
import type { TeacherBatch } from "./teacherData";

export type TeacherMe = { teacher: { fullName: string; email: string }; batches: TeacherBatch[] };

// The signed-in teacher and their assigned batches (app/api/teacher/me),
// shared by every teacher-portal page.
export function useTeacherMe() {
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teacher/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: TeacherMe) => !cancelled && setMe(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return { me, failed };
}
