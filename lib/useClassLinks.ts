"use client";

import { useEffect, useState } from "react";
import { JOIN_CLASS_URL } from "./attendanceData";

// The signed-in student's per-batch class links (app/api/student/class-links).
export function useClassLinks(): Record<string, string> {
  const [links, setLinks] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/student/class-links", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.links && setLinks(data.links))
      .catch(() => {});
  }, []);
  return links;
}

// "Join class" for a specific batch — records attendance, then forwards to
// that batch's link (see app/api/attendance/join).
export function joinClassUrl(batchId?: string | null) {
  return batchId ? `${JOIN_CLASS_URL}?batch=${encodeURIComponent(batchId)}` : JOIN_CLASS_URL;
}
