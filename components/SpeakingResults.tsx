"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { formatAttemptDate, type SkillScores } from "@/lib/speakingData";
import { useSpeakingHistory } from "@/lib/useSpeakingHistory";
import { DashboardShell } from "./DashboardShell";
import styles from "./SpeakingResults.module.css";

const skillLabels: Record<keyof SkillScores, string> = {
  pronunciation: "Pronunciation",
  fluency: "Fluency",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  sentenceStructure: "Sentence Structure",
  coherence: "Coherence",
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.scoreRow}>
      <div className={styles.scoreRowHead}>
        <span>{label}</span>
        <strong>{value.toFixed(1)}</strong>
      </div>
      <div className={styles.scoreBar}>
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${(value / 10) * 100}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export function SpeakingResults() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attempt");
  const { history, loaded } = useSpeakingHistory();
  const attempt = history.find((a) => a.id === attemptId);

  if (!loaded) {
    return (
      <DashboardShell>
        <p>Loading…</p>
      </DashboardShell>
    );
  }

  if (!attempt) {
    return (
      <DashboardShell>
        <div className={styles.head}>
          <small>SPEAKING · RESULTS</small>
          <h1>Your speaking evaluation.</h1>
        </div>
        <p>
          That attempt wasn&apos;t found. <Link href="/student-hub/speaking">Practice one now</Link> or{" "}
          <Link href="/student-hub/speaking/history">view your past attempts</Link>.
        </p>
      </DashboardShell>
    );
  }

  const evaluation = attempt.evaluation;

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>{`${attempt.topic.toUpperCase()} · ${formatAttemptDate(attempt.date)}`}</small>
        <h1>Your speaking evaluation.</h1>
      </div>

      <div className={styles.overallCard}>
        <span>OVERALL SCORE</span>
        <strong>{evaluation.overall.toFixed(1)} <small>/ 10</small></strong>
      </div>

      {evaluation.transcript && (
        <div className={styles.transcriptCard}>
          <span>WHAT YOU SAID</span>
          <p>&ldquo;{evaluation.transcript}&rdquo;</p>
        </div>
      )}

      <div className={styles.scoreGrid}>
        {(Object.keys(skillLabels) as (keyof SkillScores)[]).map((key) => (
          <ScoreBar key={key} label={skillLabels[key]} value={evaluation.scores[key]} />
        ))}
      </div>

      <div className={styles.feedbackRow}>
        <div className={styles.feedbackCard}>
          <span className={styles.feedbackLabel}>What you did well</span>
          <p>{evaluation.wellDone}</p>
        </div>
        <div className={styles.feedbackCard}>
          <span className={styles.feedbackLabel}>What to improve</span>
          <p>{evaluation.improve}</p>
        </div>
      </div>

      <section className={styles.section}>
        <h2>Corrections</h2>
        <div className={styles.correctionsList}>
          {evaluation.corrections.map((c, i) => (
            <div key={i} className={styles.correctionCard}>
              <div className={styles.correctionRow}>
                <span className={styles.correctionLabelBad}>You said</span>
                <p className={styles.correctionBad}>{c.said}</p>
              </div>
              <div className={styles.correctionRow}>
                <span className={styles.correctionLabelGood}>Better</span>
                <p className={styles.correctionGood}>{c.better}</p>
              </div>
              <small>{c.explanation}</small>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>A stronger way to say it</h2>
        <div className={styles.improvedCard}>
          <span>TRY SAYING IT THIS WAY</span>
          <p>{evaluation.improvedAnswer}</p>
        </div>
      </section>

      <div className={styles.actions}>
        <Link href="/student-hub/speaking" className={styles.practiceAgain}>Practice Again</Link>
        <Link href="/student-hub/speaking/history" className={styles.viewHistory}>View past attempts →</Link>
      </div>
    </DashboardShell>
  );
}
