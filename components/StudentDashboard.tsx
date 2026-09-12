"use client";

import { motion } from "motion/react";
import { lessons } from "@/lib/courseData";
import { computeLessonProgress, computeOverallProgress } from "@/lib/progressData";
import { getSpeakingHistory } from "@/lib/speakingData";
import { usePortalState } from "@/lib/usePortalState";
import { useStudentProfile, displayName } from "@/lib/useStudentProfile";
import { DashboardShell } from "./DashboardShell";
import styles from "./StudentDashboard.module.css";

// Mock data — stands in for what will eventually come from a real backend.
// Progress/CEFR/completed-lessons come from lib/progressData.ts instead,
// computed from actual lesson, assignment and speaking-practice activity.
const nextTask = {
  type: "Listening",
  title: "Task 04 · Interview about travel plans",
  dueDate: "Due tomorrow",
  estimatedTime: "18 min",
  progress: 40,
};

const nextClass = {
  day: "Thursday",
  time: "9:30 AM",
  teacher: "Yana",
  platform: "Google Meet",
};

const weeklyFocus = { text: "Speak with more natural connectors", tag: "TEF · Expression orale" };
const currentLevelCode = "B1";
const streak = 12;

function ProgressRing({ value }: { value: number }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  return (
    <div className={styles.ring}>
      <svg viewBox="0 0 130 130" aria-hidden="true">
        <circle cx="65" cy="65" r={r} className={styles.ringTrack} />
        <motion.circle
          cx="65" cy="65" r={r} className={styles.ringValue}
          style={{ strokeDasharray: circumference }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <div className={styles.ringLabel}>
        <strong>{value}%</strong>
        <span>French progress</span>
      </div>
    </div>
  );
}

export function StudentDashboard() {
  const { quizSessions, wordOfWeek, teacherNote } = usePortalState();
  const profile = useStudentProfile();
  const name = displayName(profile) || "there";
  const speakingHistory = getSpeakingHistory();
  const lessonProgress = computeLessonProgress(lessons);
  const overallProgress = computeOverallProgress(lessons, quizSessions, speakingHistory);

  return (
    <DashboardShell>
      <div className={styles.greeting}>
        <small>BONJOUR, {name.toUpperCase()}</small>
        <h1>Your French,<br /><em>moving forward.</em></h1>
      </div>

      <div className={styles.focusStrip}>
        <span>THIS WEEK&apos;S FOCUS</span>
        <strong>{weeklyFocus.text}</strong>
        <small>{weeklyFocus.tag}</small>
      </div>

      <div className={`${styles.card} ${styles.taskCard}`}>
        <div className={styles.taskMain}>
          <span className={styles.cardLabel}>NEXT TASK</span>
          <span className={styles.taskType}>{nextTask.type}</span>
          <strong className={styles.taskTitle}>{nextTask.title}</strong>
          <div className={styles.taskMetaRow}>
            <span>{nextTask.dueDate}</span>
            <span className={styles.metaDot} />
            <span>{nextTask.estimatedTime}</span>
          </div>
        </div>
        <div className={styles.taskProgress}>
          <div className={styles.taskProgressHead}>
            <span>Progress</span>
            <strong>{nextTask.progress}%</strong>
          </div>
          <div className={styles.progressBar}><span style={{ width: `${nextTask.progress}%` }} /></div>
          <button type="button" className={styles.cardCtaSolid}>Continue →</button>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>NEXT CLASS</span>
          <strong className={styles.cardTitle}>{nextClass.day}</strong>
          <small className={styles.cardMeta}>{nextClass.time} · {nextClass.platform}</small>
          <div className={styles.teacherLine}><i /> With {nextClass.teacher}</div>
          <button type="button" className={styles.cardCtaSolid}>Join class</button>
        </div>

        <div className={`${styles.card} ${styles.cardProgress}`}>
          <ProgressRing value={overallProgress} />
          <div className={styles.progressFacts}>
            <div><span>CEFR level</span><strong>{currentLevelCode}</strong></div>
            <div><span>Streak</span><strong>{streak} days</strong></div>
            <div><span>Completed</span><strong>{lessonProgress.completed} / {lessonProgress.total} lessons</strong></div>
          </div>
        </div>
      </div>

      <div className={styles.featuredRow}>
        <div className={styles.journalCard}>
          <span className={styles.journalFlourish} aria-hidden="true">{wordOfWeek.word.charAt(0)}</span>
          <span className={styles.journalEyebrow}>Word of the week</span>
          <strong className={styles.journalWord}>{wordOfWeek.word}</strong>
          <div className={styles.journalRule} />
          <small className={styles.journalMeaning}>{wordOfWeek.meaning}</small>
        </div>
        <div className={styles.featured}>
          <div className={styles.featuredTop}><span>TODAY&apos;S NOTE</span></div>
          <strong>{teacherNote.text}</strong>
          {teacherNote.date && <small>{teacherNote.date}</small>}
        </div>
      </div>
    </DashboardShell>
  );
}
