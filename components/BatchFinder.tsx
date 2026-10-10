"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { whatsappUrl } from "@/lib/site";
import { usePortalState } from "@/lib/usePortalState";
import { earliestStart, formatDays, formatTime, statusText, type Batch, type BatchCourse } from "@/lib/batchData";
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

  // One row per batch. A batch that meets at different times on different
  // days is ONE record with several slots (lib/batchData.ts), shown as one
  // line per slot in the Days/Time cells. Sorted by its earliest start.
  const courseBatches = useMemo(
    () => [...batches.filter((b) => b.course === course)].sort((a, b) => earliestStart(a).localeCompare(earliestStart(b))),
    [batches, course]
  );

  // Two different batches that happen to share a display name get their
  // earliest start time appended so two rows never read as identical.
  const nameCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of courseBatches) counts[b.name] = (counts[b.name] || 0) + 1;
    return counts;
  }, [courseBatches]);

  async function handleEnrollSubmit(batch: Batch, details: EnrollDetails) {
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
    // Saves the enquiry and emails the student a confirmation (see
    // app/api/leads) — EnrollModal shows an error if this fails.
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
    if (!res.ok) throw new Error(await res.text());
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
                              <strong>{batch.name}{disambiguate ? ` · ${formatTime(earliestStart(batch))}` : ""}</strong>
                              {batch.level && <small>{batch.level}</small>}
                            </td>
                            <td>
                              {batch.slots.map((slot) => (
                                <span key={slot.days.join("")} className={styles.slotLine}>{formatDays(slot.days)}</span>
                              ))}
                            </td>
                            <td>
                              {batch.slots.map((slot) => (
                                <span key={slot.days.join("")} className={styles.slotLine}>
                                  {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                                </span>
                              ))}
                            </td>
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
                        <strong>{batch.name}{disambiguate ? ` · ${formatTime(earliestStart(batch))}` : ""}</strong>
                        {batch.level && <small>{batch.level}</small>}
                        {batch.slots.map((slot) => (
                          <div key={slot.days.join("")} className={styles.cardMeta}>
                            <span>{formatDays(slot.days)}</span>
                            <span>{formatTime(slot.start_time)}–{formatTime(slot.end_time)}</span>
                          </div>
                        ))}
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
