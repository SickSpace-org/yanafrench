"use client";

import { useEffect, useState } from "react";
import { daysOverdue, todayInIndia } from "@/lib/emiData";
import type { HomeworkSection } from "@/lib/homeworkData";
import { DashboardShell } from "./DashboardShell";
import { HomeworkCard } from "./HomeworkCard";
import styles from "./AttendancePage.module.css";

type StudentHomework = {
  id: string;
  title: string;
  intro: string;
  sections: HomeworkSection[];
  dueDate: string | null;
  createdAt: string;
  batches: string[];
};

// Homework the teacher has sent to the student's batch(es), newest first.
export function HomeworkPage() {
  const [homework, setHomework] = useState<StudentHomework[] | null>(null);

  useEffect(() => {
    fetch("/api/student/homework", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setHomework(data.homework ?? []))
      .catch(() => setHomework([]));
  }, []);

  const today = todayInIndia();

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>YOUR CLASSES</small>
        <h1>Homework.</h1>
        <p>Homework from your teacher for your batch, newest first.</p>
      </div>

      {homework === null ? (
        <p className={styles.muted}>Loading…</p>
      ) : homework.length === 0 ? (
        <p className={styles.muted}>No homework yet — when your teacher sets some, it&rsquo;ll appear here.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", maxWidth: 820 }}>
          {homework.map((hw) => {
            const d = hw.dueDate ? daysOverdue(hw.dueDate, today) : null;
            return (
              <HomeworkCard
                key={hw.id}
                homework={hw}
                dueDate={hw.dueDate}
                sentAt={hw.createdAt}
                batches={hw.batches}
                actions={
                  d === null ? null : d === 0 ? (
                    <span className={`${styles.chip} ${styles.chip_absent}`}>Due today</span>
                  ) : d === -1 ? (
                    <span className={`${styles.chip} ${styles.chip_open}`}>Due tomorrow</span>
                  ) : d > 0 ? (
                    <span className={`${styles.chip} ${styles.chip_upcoming}`}>Past due</span>
                  ) : null
                }
              />
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
