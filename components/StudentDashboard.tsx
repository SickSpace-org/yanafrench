"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { lessons } from "@/lib/courseData";
import { computeLessonProgress, computeOverallProgress } from "@/lib/progressData";
import { useSpeakingHistory } from "@/lib/useSpeakingHistory";
import { useQuizState } from "@/lib/useQuizState";
import { usePortalState } from "@/lib/usePortalState";
import { useStudentProfile, displayName } from "@/lib/useStudentProfile";
import { generateClassEvents } from "@/lib/batchData";
import { site } from "@/lib/site";
import { DashboardShell } from "./DashboardShell";
import styles from "./StudentDashboard.module.css";

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
  const { wordOfWeek, teacherNote, batches, zoomLink } = usePortalState();
  const { level: currentLevelCode, sessions: quizSessions } = useQuizState();
  const profile = useStudentProfile();
  const name = displayName(profile) || "there";
  const { history: speakingHistory } = useSpeakingHistory();
  const lessonProgress = computeLessonProgress(lessons);
  const overallProgress = computeOverallProgress(lessons, quizSessions, speakingHistory);

  // The student's own enrolled batches (see lib/batchEnrollmentData.ts —
  // one person can hold more than one) — same real-data source
  // CalendarPage uses, rather than a fixed "Thursday" that was the same
  // for every student. Combined into one card: the single soonest class
  // across every enrollment, labelled by course, with a link to see the
  // rest on Calendar rather than a full multi-enrollment switcher.
  const myBatchIds = profile.kind === "student" ? new Set(profile.student.batchEnrollments.map((e) => e.batchId)) : new Set<string>();
  const myUpcomingClasses = batches
    .filter((b) => myBatchIds.has(b.id))
    .map((b) => generateClassEvents(b, zoomLink, 30)[0])
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextClass = myUpcomingClasses[0] ?? null;
  const moreUpcomingCount = Math.max(0, myUpcomingClasses.length - 1);

  return (
    <DashboardShell>
      <div className={styles.greeting}>
        <small>BONJOUR, {name.toUpperCase()}</small>
        <h1>Your French,<br /><em>moving forward.</em></h1>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>NEXT CLASS</span>
          {nextClass ? (
            <>
              <strong className={styles.cardTitle}>
                {nextClass.course} · {nextClass.date.toLocaleDateString("en-US", { weekday: "long" })}
              </strong>
              <small className={styles.cardMeta}>{nextClass.time}</small>
              <div className={styles.teacherLine}><i /> With {site.tutor}</div>
              {zoomLink ? (
                <a href={zoomLink} target="_blank" rel="noreferrer" className={styles.cardCtaSolid}>Join class</a>
              ) : (
                <button type="button" className={styles.cardCtaSolid} disabled>Link coming soon</button>
              )}
              {moreUpcomingCount > 0 && (
                <Link href="/student-hub/calendar" className={styles.cardMeta} style={{ display: "block", marginTop: ".5rem" }}>
                  +{moreUpcomingCount} more upcoming · View calendar →
                </Link>
              )}
            </>
          ) : (
            <>
              <strong className={styles.cardTitle}>No class scheduled</strong>
              <small className={styles.cardMeta}>Ask {site.tutor.split(" ")[0]} about your batch</small>
            </>
          )}
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
