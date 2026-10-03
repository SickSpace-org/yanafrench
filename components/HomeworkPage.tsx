"use client";

import { useEffect, useState } from "react";
import { daysOverdue, formatIndiaDate, isoToIndiaDate, todayInIndia } from "@/lib/emiData";
import type { HomeworkAnswers, HomeworkFeedback, HomeworkSection } from "@/lib/homeworkData";
import { DashboardShell } from "./DashboardShell";
import { HomeworkCard } from "./HomeworkCard";
import { FeedbackSummary, TaskFeedback } from "./HomeworkFeedback";
import styles from "./AttendancePage.module.css";
import card from "./HomeworkCard.module.css";

type Submission = { answers: HomeworkAnswers; feedback: HomeworkFeedback | null; submittedAt: string; updatedAt: string };

type StudentHomework = {
  id: string;
  title: string;
  intro: string;
  sections: HomeworkSection[];
  dueDate: string | null;
  createdAt: string;
  batches: string[];
  submission: Submission | null;
};

function emptyAnswers(sections: HomeworkSection[], from?: HomeworkAnswers): HomeworkAnswers {
  return sections.map((s, i) => s.tasks.map((_, j) => from?.[i]?.[j] ?? ""));
}

function formatWhen(iso: string) {
  return `${formatIndiaDate(isoToIndiaDate(iso))}, ${new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso))}`;
}

function HomeworkItem({ hw, preview, today }: { hw: StudentHomework; preview: boolean; today: string }) {
  const [answers, setAnswers] = useState<HomeworkAnswers>(() => emptyAnswers(hw.sections, hw.submission?.answers));
  const [submission, setSubmission] = useState<Submission | null>(hw.submission);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedAnswers = emptyAnswers(hw.sections, submission?.answers);
  const dirty = JSON.stringify(answers) !== JSON.stringify(savedAnswers);
  const hasAny = answers.some((row) => row.some((a) => a.trim()));
  const d = hw.dueDate ? daysOverdue(hw.dueDate, today) : null;

  function setAnswer(s: number, t: number, value: string) {
    setAnswers((prev) => prev.map((row, i) => (i === s ? row.map((a, j) => (j === t ? value : a)) : row)));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/homework/${encodeURIComponent(hw.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Couldn't submit — please try again.");
      const data = (await res.json()) as { submission: Submission };
      setSubmission(data.submission);
      setAnswers(emptyAnswers(hw.sections, data.submission.answers));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const chip = submission ? (
    <span className={`${styles.chip} ${styles.chip_present}`}>Submitted</span>
  ) : d === null ? null : d === 0 ? (
    <span className={`${styles.chip} ${styles.chip_absent}`}>Due today</span>
  ) : d === -1 ? (
    <span className={`${styles.chip} ${styles.chip_open}`}>Due tomorrow</span>
  ) : d > 0 ? (
    <span className={`${styles.chip} ${styles.chip_absent}`}>Past due</span>
  ) : null;

  return (
    <HomeworkCard
      homework={hw}
      dueDate={hw.dueDate}
      sentAt={hw.createdAt}
      batches={hw.batches}
      actions={chip}
      renderTask={(s, t) => (
        <>
          <textarea
            className={card.answerInput}
            aria-label={`Answer for ${hw.sections[s].heading || `section ${s + 1}`}, task ${t + 1}`}
            placeholder="Your answer…"
            rows={Math.min(8, Math.max(1, answers[s][t].split("\n").length))}
            value={answers[s][t]}
            disabled={preview || saving}
            onChange={(e) => setAnswer(s, t, e.target.value)}
          />
          {/* Only while the answer is still the one that was checked. */}
          {answers[s][t] === savedAnswers[s][t] && <TaskFeedback item={submission?.feedback?.items[s]?.[t]} />}
        </>
      )}
    >
      {submission?.feedback && !dirty && <FeedbackSummary feedback={submission.feedback} />}
      <button type="button" className={card.submit} onClick={submit} disabled={preview || saving || !hasAny || (!!submission && !dirty)}>
        {saving ? "Submitting & checking…" : submission ? "Resubmit answers" : "Submit homework"}
      </button>
      {preview ? (
        <span className={card.status}>Preview — students submit from their own account.</span>
      ) : error ? (
        <span className={card.statusError}>{error}</span>
      ) : submission ? (
        <span className={dirty ? card.status : card.statusDone}>
          {dirty
            ? "You've changed your answers — resubmit to send the new version and get it checked again."
            : `Submitted ${formatWhen(submission.updatedAt)}${submission.updatedAt !== submission.submittedAt ? " (updated)" : ""}`}
        </span>
      ) : (
        <span className={card.status}>Answer what you can — you can edit and resubmit any time.</span>
      )}
    </HomeworkCard>
  );
}

// Homework the teacher has sent to the student's batch(es), newest first,
// with an answer box under every task.
export function HomeworkPage() {
  const [homework, setHomework] = useState<StudentHomework[] | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    fetch("/api/student/homework", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setHomework(data.homework ?? []);
        setPreview(!!data.preview);
      })
      .catch(() => setHomework([]));
  }, []);

  const today = todayInIndia();
  const pending = (homework ?? []).filter((h) => !h.submission).length;

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>YOUR CLASSES</small>
        <h1>Homework.</h1>
        <p>
          Homework from your teacher for your batch, newest first. Type your answers under each task and submit — they’re checked straight away and you’ll see what to fix. You can edit and resubmit any time.
          {homework && homework.length > 0 && !preview ? ` ${pending === 0 ? "All caught up!" : `${pending} still to submit.`}` : ""}
        </p>
      </div>

      {homework === null ? (
        <p className={styles.muted}>Loading…</p>
      ) : homework.length === 0 ? (
        <p className={styles.muted}>No homework yet — when your teacher sets some, it&rsquo;ll appear here.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", maxWidth: 820 }}>
          {homework.map((hw) => (
            <HomeworkItem key={hw.id} hw={hw} preview={preview} today={today} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
