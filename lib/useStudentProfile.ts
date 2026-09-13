"use client";

import { useCallback, useEffect, useState } from "react";
import type { Student } from "./studentData";

// Real signed-in identity for the student-hub UI (DashboardShell,
// StudentDashboard, SettingsPage) — replaces the old hardcoded "Amelia"
// mock. A single fetch on mount is enough here (unlike usePortalState /
// useMessageThread, which poll): identity doesn't change mid-session
// except when the student edits their own profile — call `refresh` after
// that.
export type StudentProfile =
  | { kind: "loading" }
  | { kind: "student"; student: Student }
  | { kind: "admin-preview"; email: string }
  | { kind: "error" };

export function useStudentProfile(): StudentProfile & { refresh: () => void } {
  const [profile, setProfile] = useState<StudentProfile>({ kind: "loading" });

  const refresh = useCallback(() => {
    fetch("/api/student/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (data.kind === "student") setProfile({ kind: "student", student: data.student });
        else if (data.kind === "admin-preview") setProfile({ kind: "admin-preview", email: data.email });
        else setProfile({ kind: "error" });
      })
      .catch(() => {
        setProfile({ kind: "error" });
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...profile, refresh };
}

// Convenience for display-only spots (nav name, initials, greeting) that
// don't need to distinguish loading/error from "no name yet" — falls back
// to the account email, then a generic label, never a stale mock name.
export function displayName(profile: StudentProfile): string {
  if (profile.kind === "student") return profile.student.name;
  if (profile.kind === "admin-preview") return profile.email;
  return "";
}
