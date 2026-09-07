"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type FormEvent } from "react";
import { formatTime, statusText, type Batch, type BatchCourse } from "@/lib/batchData";
import { CURRENT_LEVELS, type CurrentLevel } from "@/lib/leadData";
import styles from "./EnrollModal.module.css";

const COURSES: BatchCourse[] = ["TEF", "TCF", "DELF"];

function canSelect(batch: Batch) {
  return (batch.status !== "full" && batch.seats_remaining > 0) || batch.status === "waitlist";
}

export type EnrollDetails = {
  name: string;
  phone: string;
  email: string;
  currentLevel: CurrentLevel | "";
  notes: string;
};

export function EnrollModal({
  batches,
  initialBatch,
  onClose,
  onSubmit,
}: {
  batches: Batch[];
  initialBatch: Batch;
  onClose: () => void;
  onSubmit: (batch: Batch, details: EnrollDetails) => void;
}) {
  const [course, setCourse] = useState<BatchCourse>(initialBatch.course);
  const [batchId, setBatchId] = useState(initialBatch.id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currentLevel, setCurrentLevel] = useState<CurrentLevel | "">("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const courseBatches = useMemo(
    () => batches.filter((b) => b.course === course && canSelect(b)),
    [batches, course]
  );

  const batch = useMemo(
    () => courseBatches.find((b) => b.id === batchId) || courseBatches[0] || null,
    [courseBatches, batchId]
  );

  function handleCourseChange(next: BatchCourse) {
    setCourse(next);
    const firstOfCourse = batches.find((b) => b.course === next && canSelect(b));
    setBatchId(firstOfCourse?.id ?? "");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!batch || !name.trim() || !phone.trim() || !email.trim()) return;
    onSubmit(batch, { name: name.trim(), phone: phone.trim(), email: email.trim(), currentLevel, notes: notes.trim() });
    setSubmitted(true);
  }

  return (
    <AnimatePresence>
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 18, scale: .97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: .98 }}
          transition={{ duration: .25 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Enroll for a batch"
        >
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>

          {submitted ? (
            <div className={styles.success}>
              <div className={styles.batchTag}>Submitted</div>
              <h3>Thanks, {name.split(" ")[0]}!</h3>
              <p className={styles.batchMeta}>
                Your enrollment inquiry for the {batch?.course} batch is in. Yana will personally confirm availability and reach out on {phone} or {email} soon.
              </p>
              <button type="button" className={styles.submit} onClick={onClose}>Done</button>
            </div>
          ) : (
          <>
          <div className={styles.batchTag}>Enroll now</div>
          <h3>Tell Yana about yourself.</h3>
          <p className={styles.batchMeta}>A website form doesn&apos;t reserve a seat — Yana confirms availability personally.</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.fieldRow}>
              <label>
                <span>Course</span>
                <select value={course} onChange={(e) => handleCourseChange(e.target.value as BatchCourse)}>
                  {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>
                <span>Batch</span>
                {courseBatches.length ? (
                  <select value={batch?.id ?? ""} onChange={(e) => setBatchId(e.target.value)}>
                    {courseBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} · {b.days.join("/")} {formatTime(b.start_time)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select disabled><option>No open batches</option></select>
                )}
              </label>
            </div>

            {batch && (
              <p className={styles.batchSummary}>
                {batch.days.join(" · ")} · {formatTime(batch.start_time)}–{formatTime(batch.end_time)} · {statusText(batch)}
              </p>
            )}

            <label>
              <span>Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            </label>

            <div className={styles.fieldRow}>
              <label>
                <span>Phone number</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9XXXXXXXXX" required />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
              </label>
            </div>

            <label>
              <span>Current French level (optional)</span>
              <select value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value as CurrentLevel | "")}>
                <option value="">Not sure / prefer to discuss</option>
                {CURRENT_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </label>

            <label>
              <span>Anything Yana should know? (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Target exam date, scheduling constraints, goals…"
                rows={3}
              />
            </label>

            <button type="submit" className={styles.submit} disabled={!batch}>
              Submit
            </button>
          </form>
          </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
