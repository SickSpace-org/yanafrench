"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatTime, statusText, type Batch, type BatchCourse } from "@/lib/batchData";
import { CURRENT_LEVELS, type CurrentLevel } from "@/lib/leadData";
import { site, whatsappDisplay, whatsappUrl } from "@/lib/site";
import { PhoneNumberInput, isValidPhoneNumber } from "./PhoneNumberInput";
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

type Phase = "form" | "submitted";

export function EnrollModal({
  batches,
  initialBatch,
  onClose,
  onSubmit,
}: {
  batches: Batch[];
  initialBatch: Batch;
  onClose: () => void;
  // Saves the enquiry (which also emails the student); rejects on failure.
  onSubmit: (batch: Batch, details: EnrollDetails) => Promise<void>;
}) {
  const [course, setCourse] = useState<BatchCourse>(initialBatch.course);
  const [batchId, setBatchId] = useState(initialBatch.id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currentLevel, setCurrentLevel] = useState<CurrentLevel | "">("");
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedBatch, setSubmittedBatch] = useState<Batch | null>(null);
  const tutor = site.tutor.split(" ")[0];

  // The site nav is a fixed, high-z-index pill that otherwise sits on top
  // of this modal, blocking its close control. Hidden for as long as this
  // modal is mounted, regardless of phase.
  useEffect(() => {
    document.body.classList.add("enroll-modal-open");
    return () => document.body.classList.remove("enroll-modal-open");
  }, []);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!batch || !name.trim() || !phone.trim() || !email.trim() || !isValidPhoneNumber(phone)) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(batch, { name: name.trim(), phone: phone.trim(), email: email.trim(), currentLevel, notes: notes.trim() });
      setSubmittedBatch(batch);
      setPhase("submitted");
    } catch {
      setError("Couldn't send your enrollment. Please try again, or message Yana on WhatsApp.");
    } finally {
      setSubmitting(false);
    }
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

          {phase === "submitted" && (
            <div className={styles.success}>
              <div className={styles.batchTag}>Enrollment received</div>
              <h3>Thanks, {name.split(" ")[0]}!</h3>
              <p className={styles.batchMeta}>
                Your enrollment for the {submittedBatch?.course} · {submittedBatch?.name} batch is in. We&apos;ve emailed a confirmation to {email}.
                {" "}{tutor} will contact you on {phone} to confirm your seat and share the payment details.
              </p>
              <p className={styles.batchMeta}>For more info, message {tutor} on WhatsApp at {whatsappDisplay}.</p>
              <div className={styles.fieldRow}>
                <a
                  href={whatsappUrl(`Hi ${tutor}! I just enrolled in the ${submittedBatch?.course} ${submittedBatch?.name ?? ""} batch on the website (${email}). Could you share the next steps?`)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.submit}
                >
                  Chat with {tutor} on WhatsApp
                </a>
                <button type="button" className={styles.secondary} onClick={onClose}>Done</button>
              </div>
            </div>
          )}

          {phase === "form" && (
            <>
              <div className={styles.batchTag}>Enroll now</div>
              <h3>Tell Yana about yourself.</h3>
              <p className={styles.batchMeta}>
                Send your details and {tutor} will get in touch to confirm your seat and share the payment details. Questions first? WhatsApp{" "}
                <a href={whatsappUrl()} target="_blank" rel="noreferrer">{whatsappDisplay}</a>.
              </p>

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
                    <PhoneNumberInput value={phone} onChange={setPhone} required />
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

                {error && <p className={styles.batchMeta} role="alert">{error}</p>}

                <button type="submit" className={styles.submit} disabled={!batch || submitting}>
                  {submitting ? "Sending…" : "Submit enrollment"}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
