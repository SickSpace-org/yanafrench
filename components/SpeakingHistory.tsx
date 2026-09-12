"use client";

import Link from "next/link";
import { formatAttemptDate } from "@/lib/speakingData";
import { useSpeakingHistory } from "@/lib/useSpeakingHistory";
import { DashboardShell } from "./DashboardShell";
import styles from "./SpeakingHistory.module.css";

export function SpeakingHistory() {
  const { history, loaded } = useSpeakingHistory();

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>SPEAKING · HISTORY</small>
        <h1>Your past attempts.</h1>
      </div>

      {!loaded ? (
        <p>Loading…</p>
      ) : history.length === 0 ? (
        <p>No attempts yet — <Link href="/student-hub/speaking">practice one now</Link>.</p>
      ) : (
        <div className={styles.list}>
          {history.map((attempt) => (
            <div key={attempt.id} className={styles.row}>
              <div className={styles.rowMain}>
                <strong>{attempt.topic} · {formatAttemptDate(attempt.date)}</strong>
                <small>{attempt.durationLabel} · {attempt.status}</small>
              </div>
              <div className={styles.rowScore}>
                <strong>{attempt.evaluation.overall.toFixed(1)} <span>/ 10</span></strong>
                <small>Fluency {attempt.evaluation.scores.fluency.toFixed(1)} · Grammar {attempt.evaluation.scores.grammar.toFixed(1)}</small>
              </div>
              <Link href={`/student-hub/speaking/results?attempt=${attempt.id}`} className={styles.viewLink}>View feedback →</Link>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
