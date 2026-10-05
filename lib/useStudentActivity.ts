"use client";

import { useEffect, useState } from "react";

export type StudentActivity = {
  loaded: boolean;
  classesAttended: number;
  classesHeld: number;
  homeworkDone: number;
  homeworkTotal: number;
};

// Real counts for the dashboard's progress card: classes attended out of
// those already held (app/api/student/attendance — upcoming/open sessions
// don't count yet) and homework submitted out of homework received
// (app/api/student/homework). Fetched once on mount.
export function useStudentActivity(): StudentActivity {
  const [state, setState] = useState<StudentActivity>({ loaded: false, classesAttended: 0, classesHeld: 0, homeworkDone: 0, homeworkTotal: 0 });

  useEffect(() => {
    let cancelled = false;
    const get = (url: string): Promise<{ sessions?: { status: string }[]; homework?: { submission: unknown }[]; preview?: boolean }> =>
      fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    Promise.all([get("/api/student/attendance"), get("/api/student/homework")]).then(([att, hw]) => {
      if (cancelled) return;
      const held = (att.sessions ?? []).filter((s) => s.status === "present" || s.status === "absent");
      const homework = hw.preview ? [] : hw.homework ?? [];
      setState({
        loaded: true,
        classesAttended: held.filter((s) => s.status === "present").length,
        classesHeld: held.length,
        homeworkDone: homework.filter((h) => h.submission).length,
        homeworkTotal: homework.length,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
