"use client";

import { useEffect, useState } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import type { Student } from "@/lib/studentData";
import type { QuizLevel, QuizSession } from "@/lib/quizData";
import { AdminQuizPanel } from "./AdminQuizPanel";
import styles from "./AdminLessonsManager.module.css";

// Quiz level and history are per-student now (see lib/quizStore.ts) — this
// picks which student's quiz state Admin -> Lessons' Quiz tab shows,
// replacing the single sitewide level control. Only students with a
// linked login (userId set) have a quiz store to view.
export function AdminQuizTab() {
  const { items: students, loaded } = useAdminCollection<Student>("/api/students");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState<QuizLevel | null>(null);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [stateLoaded, setStateLoaded] = useState(false);

  const eligible = students.filter((s): s is Student & { userId: string } => Boolean(s.userId));
  const selected = eligible.find((s) => s.id === selectedId) ?? eligible[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setStateLoaded(false);
    fetch(`/api/quiz/state?studentUserId=${encodeURIComponent(selected.userId)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (cancelled) return;
        setLevel(data.level);
        setSessions(data.sessions);
      })
      .catch(() => {
        if (!cancelled) {
          setLevel(null);
          setSessions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setStateLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function handleLevelChange(newLevel: QuizLevel) {
    if (!selected) return;
    setLevel(newLevel);
    await fetch("/api/quiz/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentUserId: selected.userId, level: newLevel }),
    });
  }

  if (!loaded) return <p className={styles.tabHint}>Loading…</p>;
  if (eligible.length === 0) return <p className={styles.tabHint}>No students with a linked login yet.</p>;

  return (
    <div className={styles.tabPanel}>
      <div className={styles.form} style={{ maxWidth: 320 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: ".4rem", fontSize: ".68rem", fontWeight: 700, color: "var(--text-faint)" }}>
          <span>Student</span>
          <select value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>

      {stateLoaded && level ? (
        <AdminQuizPanel level={level} sessions={sessions} onLevelChange={handleLevelChange} />
      ) : (
        <p className={styles.tabHint}>Loading…</p>
      )}
    </div>
  );
}
