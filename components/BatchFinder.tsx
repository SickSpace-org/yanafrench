"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { whatsappUrl } from "@/lib/site";
import { usePortalState } from "@/lib/usePortalState";
import { formatDays, formatTime, statusText, type Batch, type BatchCourse } from "@/lib/batchData";
import type { Lead } from "@/lib/leadData";
import { EnrollModal, type EnrollDetails } from "./EnrollModal";
import styles from "./BatchFinder.module.css";

const COURSES: { code: BatchCourse; title: string; note: string }[] = [
  { code: "TEF", title: "TEF", note: "Canada & score-focused preparation" },
  { code: "TCF", title: "TCF", note: "Structured exam preparation" },
  { code: "DELF", title: "DELF", note: "A1–B2 language certification" },
];

function canSelect(batch: Batch) {
  return batch.status !== "full" && batch.seats_remaining > 0;
}

export function BatchFinder({ standalone = false }: { standalone?: boolean }) {
  const { loaded, batches: allBatches } = usePortalState();
  const [course, setCourse] = useState<BatchCourse>("TEF");
  const [enrollingBatch, setEnrollingBatch] = useState<Batch | null>(null);
  const reduceMotion = useReducedMotion();

  const batches = useMemo(() => allBatches.filter((b) => b.published), [allBatches]);

  // One row per batch — the underlying data already stores every batch as a
  // single record with a `days` array, so no de-duplication is needed here,
  // just a stable sort for scanning. (Two source batches with different
  // times on different days were entered as multiple records at the data
  // level, since a batch here has one time slot for all its days — those
  // share a name but carry distinct days/times, handled below.)
  const courseBatches = useMemo(
    () => [...batches.filter((b) => b.course === course)].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [batches, course]
  );

  // Batches sharing a display name but different day/time records (e.g. an
  // "Evening Batch (Late)" split across a few time slots) get their time
  // appended to the name so two rows never read as identical.
  const nameCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of courseBatches) counts[b.name] = (counts[b.name] || 0) + 1;
    return counts;
  }, [courseBatches]);

  function handleEnrollSubmit(batch: Batch, details: EnrollDetails) {
    const lead: Lead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: details.name,
      phone: details.phone,
      email: details.email,
      currentLevel: details.currentLevel || null,
      notes: details.notes || null,
      course: batch.course,
      batchId: batch.id,
      batchName: batch.name,
      createdAt: new Date().toISOString(),
      paymentStatus: "pending",
    };
    // Fire-and-forget, same as the old optimistic addLead — the id is
    // generated client-side so it's available immediately for the payment
    // step without waiting on this request.
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    }).catch(() => {});
    return lead.id;
  }

  return (
    <section
      id="find-your-batch"
      className={`${styles.section} ${standalone ? styles.standalone : ""}`}
    >
      <div className="container">
        <div className={styles.intro}>
          <div>
            <p className="eyebrow">Find your class</p>
            <h2>Choose the rhythm<br/><em>that fits your week.</em></h2>
          </div>
          <div className={styles.introCopy}>
            <p>Select your course, explore Yana&apos;s current batch availability and submit an enrollment enquiry when you find the right fit.</p>
            <div className={styles.liveLine}><span/> Live availability · India Standard Time</div>
          </div>
        </div>

        <div className={styles.coursePicker} aria-label="Choose a course">
          {COURSES.map((item, index) => (
            <button
              key={item.code}
              className={`${styles.courseCard} ${course === item.code ? styles.courseCardActive : ""}`}
              onClick={() => setCourse(item.code)}
              type="button"
              aria-pressed={course === item.code}
            >
              <span className={styles.courseNumber}>0{index + 1}</span>
              <strong>{item.title}</strong>
              <small>{item.note}</small>
            </button>
          ))}
        </div>

        <div className={styles.scheduleTop}>
          <div>
            <span className={styles.scheduleCourse}>{course}</span>
            <h3>Available batches.</h3>
          </div>
          <p>Monday–Saturday · 8:00 AM–6:00 PM IST</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={course}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
            transition={{ duration: reduceMotion ? 0 : .3 }}
          >
            {!loaded ? (
              <div className={styles.state}>Checking Yana&apos;s latest availability…</div>
            ) : courseBatches.length === 0 ? (
              <div className={styles.state}>
                No {course} batches are published right now. <a href={whatsappUrl(`Hi Yana! I found The Français Hub website and I'm interested in ${course}. Could you let me know when the next batch opens?`)} target="_blank" rel="noreferrer">Ask about the next batch →</a>
              </div>
            ) : (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Batch</th>
                        <th>Days</th>
                        <th>Time</th>
                        <th>Availability</th>
                        <th aria-hidden="true" />
                      </tr>
                    </thead>
                    <tbody>
                      {courseBatches.map((batch) => {
                        const selectable = canSelect(batch) || batch.status === "waitlist";
                        const disambiguate = nameCounts[batch.name] > 1;
                        return (
                          <tr key={batch.id} className={!selectable ? styles.rowDisabled : ""}>
                            <td>
                              <strong>{batch.name}{disambiguate ? ` · ${formatTime(batch.start_time)}` : ""}</strong>
                              {batch.level && <small>{batch.level}</small>}
                            </td>
                            <td>{formatDays(batch.days)}</td>
                            <td>{formatTime(batch.start_time)}–{formatTime(batch.end_time)}</td>
                            <td>
                              <span className={`${styles.status} ${styles[`status_${batch.status}`] || ""}`}>{statusText(batch)}</span>
                            </td>
                            <td>
                              {selectable ? (
                                <button type="button" className={styles.enrollBtn} onClick={() => setEnrollingBatch(batch)}>
                                  {batch.status === "waitlist" ? "Join waitlist" : "Enroll now"}
                                  <span aria-hidden="true">→</span>
                                </button>
                              ) : (
                                <span className={styles.fullLabel}>Full</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className={styles.cardList}>
                  {courseBatches.map((batch) => {
                    const selectable = canSelect(batch) || batch.status === "waitlist";
                    const disambiguate = nameCounts[batch.name] > 1;
                    return (
                      <div key={batch.id} className={!selectable ? `${styles.card} ${styles.rowDisabled}` : styles.card}>
                        <div className={styles.cardHead}>
                          <span className={styles.cardCourse}>{batch.course}</span>
                          <span className={`${styles.status} ${styles[`status_${batch.status}`] || ""}`}>{statusText(batch)}</span>
                        </div>
                        <strong>{batch.name}{disambiguate ? ` · ${formatTime(batch.start_time)}` : ""}</strong>
                        {batch.level && <small>{batch.level}</small>}
                        <div className={styles.cardMeta}>
                          <span>{formatDays(batch.days)}</span>
                          <span>{formatTime(batch.start_time)}–{formatTime(batch.end_time)}</span>
                        </div>
                        {selectable ? (
                          <button type="button" className={styles.enrollBtn} onClick={() => setEnrollingBatch(batch)}>
                            {batch.status === "waitlist" ? "Join waitlist" : "Enroll now"}
                            <span aria-hidden="true">→</span>
                          </button>
                        ) : (
                          <span className={styles.fullLabel}>Batch full</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {enrollingBatch && (
        <EnrollModal
          batches={batches}
          initialBatch={enrollingBatch}
          onClose={() => setEnrollingBatch(null)}
          onSubmit={handleEnrollSubmit}
        />
      )}
    </section>
  );
}
