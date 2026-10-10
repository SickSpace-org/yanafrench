"use client";

import { useEffect, useState } from "react";
import type { BatchMaterial, BatchRecording } from "./batchContentData";

export type StudentBatchContent = { recordings: BatchRecording[]; materials: BatchMaterial[]; batchNames: Record<string, string> };

// Recordings and files shared by the teachers of the student's own batches
// (app/api/student/batch-content).
export function useStudentBatchContent(): StudentBatchContent {
  const [content, setContent] = useState<StudentBatchContent>({ recordings: [], materials: [], batchNames: {} });
  useEffect(() => {
    fetch("/api/student/batch-content", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setContent(data))
      .catch(() => {});
  }, []);
  return content;
}
