"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  cefrLevels,
  computeOverallProgress,
  computeSkillProgress,
  testTarget,
  type CefrLevel,
} from "@/lib/progressData";
import { lessons } from "@/lib/courseData";
import { useSpeakingHistory } from "@/lib/useSpeakingHistory";
import { useQuizState } from "@/lib/useQuizState";
import { useVocabState } from "@/lib/useVocabState";
import { getVocabulary } from "@/lib/vocabData";
import { DashboardShell } from "./DashboardShell";
import styles from "./ProgressPage.module.css";

const nodeX = [60, 290, 520, 750, 940];
const nodeY = [140, 60, 140, 60, 140];

function buildPath() {
  let d = `M${nodeX[0]},${nodeY[0]} `;
  for (let i = 1; i < nodeX.length; i++) {
    const mid = (nodeX[i - 1] + nodeX[i]) / 2;
    d += `C${mid},${nodeY[i - 1]} ${mid},${nodeY[i]} ${nodeX[i]},${nodeY[i]} `;
  }
  return d.trim();
}

export function ProgressPage() {
  const { level: currentLevelCode, sessions: quizSessions } = useQuizState();
  const currentIndex = cefrLevels.findIndex((l) => l.code === currentLevelCode);
  const nextLevel = cefrLevels[currentIndex + 1];
  const currentLevel = cefrLevels[currentIndex];
  const [selected, setSelected] = useState<CefrLevel | null>(null);
  const { history: speakingHistory } = useSpeakingHistory();
  const { savedWords } = useVocabState();
  const vocabCount = getVocabulary().length + savedWords.length;
  const skills = computeSkillProgress(quizSessions, speakingHistory, vocabCount);
  const overallProgress = computeOverallProgress(lessons, quizSessions, speakingHistory);

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>LE HUB</small>
        <h1>Your French,<br /><em>your journey.</em></h1>
      </div>

      <div className={styles.journeyCard}>
        <svg viewBox="0 0 1000 200" className={styles.journeySvg} aria-hidden="true">
          <path d={buildPath()} className={styles.journeyPathFuture} />
          <motion.path
            d={buildPath()}
            className={styles.journeyPathDone}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: currentIndex / (nodeX.length - 1) }}
            transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className={styles.journeyNodes}>
          {cefrLevels.map((level, i) => {
            const status = i < currentIndex ? "done" : i === currentIndex ? "current" : "future";
            return (
              <button
                key={level.code}
                type="button"
                className={styles.node}
                style={{ left: `${(nodeX[i] / 1000) * 100}%`, top: `${(nodeY[i] / 200) * 100}%` }}
                onClick={() => setSelected(level)}
              >
                {status === "current" && <span className={styles.here}>YOU ARE HERE</span>}
                <span className={status === "done" ? styles.dotDone : status === "current" ? styles.dotCurrent : styles.dotFuture}>
                  {status === "done" ? "✓" : level.code}
                </span>
                <span className={styles.nodeLabel}>{level.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span>CURRENT LEVEL</span>
          <strong>{currentLevel.code} — {currentLevel.label}</strong>
        </div>
        <div className={styles.statCard}>
          <span>NEXT LEVEL</span>
          <strong>{nextLevel ? `${nextLevel.code} — ${nextLevel.label}` : "—"}</strong>
        </div>
        <div className={`${styles.statCard} ${styles.statCardAccent}`}>
          <span>OVERALL PROGRESS</span>
          <strong>{overallProgress}%</strong>
          <div className={styles.progressBar}><span style={{ width: `${overallProgress}%` }} /></div>
        </div>
        <div className={styles.statCard}>
          <span>TEST TARGET</span>
          <strong>{testTarget.reached} / {testTarget.of}</strong>
          <small>currently reached</small>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Skill progress</h2>
        <div className={styles.skillGrid}>
          {skills.map((s) => (
            <div key={s.skill} className={styles.skillCard}>
              <span>{s.skill.toUpperCase()}</span>
              <strong className={s.type === "delta" ? styles.skillDelta : styles.skillScore}>{s.value}</strong>
              <small>{s.detail}</small>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.panelClose} onClick={() => setSelected(null)} aria-label="Close">×</button>
            <span className={styles.panelEyebrow}>{selected.code} → {cefrLevels[cefrLevels.findIndex((l) => l.code === selected.code) + 1]?.code ?? selected.code}</span>
            <h2>{selected.code} — {selected.label}</h2>
            {selected.code === currentLevelCode && <div className={styles.panelProgress}>{overallProgress}% progress</div>}
            <p className={styles.panelDescription}>{selected.description}</p>

            {selected.skillsAchieved.length > 0 && (
              <div className={styles.panelSection}>
                <h3>Skills already achieved</h3>
                <ul>{selected.skillsAchieved.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}

            {selected.skillsToImprove.length > 0 && (
              <div className={styles.panelSection}>
                <h3>To reach the next level, focus on</h3>
                <ul>{selected.skillsToImprove.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}

            {selected.recentAssessments.length > 0 && (
              <div className={styles.panelSection}>
                <h3>Recent assessments</h3>
                {selected.recentAssessments.map((a) => (
                  <div key={a.title} className={styles.assessmentRow}>
                    <span>{a.title}</span>
                    <strong>{a.score}</strong>
                    <small>{a.date}</small>
                  </div>
                ))}
              </div>
            )}

            {selected.recommendedLessons.length > 0 && (
              <div className={styles.panelSection}>
                <h3>Recommended lessons</h3>
                <ul>{selected.recommendedLessons.map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
