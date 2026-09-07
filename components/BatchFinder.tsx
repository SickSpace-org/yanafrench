"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { whatsappUrl } from "@/lib/site";
import { usePortalState } from "@/lib/usePortalState";
import { DAYS, DAY_LABELS, formatTime, statusText, type Batch, type BatchCourse } from "@/lib/batchData";
import type { Lead } from "@/lib/leadData";
import { EnrollModal } from "./EnrollModal";
import styles from "./BatchFinder.module.css";

const COURSES: { code: BatchCourse; title: string; note: string }[] = [
  { code: "TEF", title: "TEF", note: "Canada & score-focused preparation" },
  { code: "TCF", title: "TCF", note: "Structured exam preparation" },
  { code: "DELF", title: "DELF", note: "A1–B2 language certification" },
];

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

function canSelect(batch: Batch) {
  return batch.status !== "full" && batch.seats_remaining > 0;
}

function whatsappMessage(batch: Batch) {
  const dayNames = batch.days.map((day) => DAY_LABELS[day] || day).join(", ");
  const time = `${formatTime(batch.start_time)}–${formatTime(batch.end_time)} IST`;
  const start = formatDate(batch.start_date);

  if (batch.status === "waitlist") {
    return `Hi Yana! I found The Français Hub website and I'd like to join the waitlist for the ${batch.course} batch I selected.\n\nBatch: ${batch.name}${batch.level ? `\nLevel: ${batch.level}` : ""}\nDays: ${dayNames}\nTime: ${time}${start ? `\nStarts: ${start}` : ""}\n\nCould you please let me know the next step?`;
  }

  return `Hi Yana! I found The Français Hub website and I'm interested in the ${batch.course} batch I selected.\n\nBatch: ${batch.name}${batch.level ? `\nLevel: ${batch.level}` : ""}\nDays: ${dayNames}\nTime: ${time}${start ? `\nStarts: ${start}` : ""}\n\nCould you please confirm if a seat is still available?`;
}

export function BatchFinder({ standalone = false }: { standalone?: boolean }) {
  const { loaded, batches: allBatches, addLead } = usePortalState();
  const [course, setCourse] = useState<BatchCourse>("TEF");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enrollingBatch, setEnrollingBatch] = useState<Batch | null>(null);

  const batches = useMemo(() => allBatches.filter((b) => b.published), [allBatches]);

  const courseBatches = useMemo(
    () => batches.filter((batch) => batch.course === course),
    [batches, course]
  );

  const selected = useMemo(
    () => batches.find((batch) => batch.id === selectedId) || null,
    [batches, selectedId]
  );

  function chooseCourse(next: BatchCourse) {
    setCourse(next);
    setSelectedId(null);
  }

  function handleEnrollSubmit(details: { name: string; phone: string; email: string }) {
    const batch = enrollingBatch;
    if (!batch) return;
    const lead: Lead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...details,
      course: batch.course,
      batchId: batch.id,
      batchName: batch.name,
      createdAt: new Date().toISOString(),
    };
    addLead(lead);
    setEnrollingBatch(null);
    window.open(whatsappUrl(whatsappMessage(batch)), "_blank", "noreferrer");
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
            <p>Select your course, explore Yana&apos;s current batch availability and continue on WhatsApp when you find the right fit.</p>
            <div className={styles.liveLine}><span/> Live availability · India Standard Time</div>
          </div>
        </div>

        <div className={styles.coursePicker} aria-label="Choose a course">
          {COURSES.map((item, index) => (
            <button
              key={item.code}
              className={`${styles.courseCard} ${course === item.code ? styles.courseCardActive : ""}`}
              onClick={() => chooseCourse(item.code)}
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

        {!loaded ? (
          <div className={styles.state}>Checking Yana&apos;s latest availability…</div>
        ) : courseBatches.length === 0 ? (
          <div className={styles.state}>
            No {course} batches are published right now. <a href={whatsappUrl(`Hi Yana! I found The Français Hub website and I'm interested in ${course}. Could you let me know when the next batch opens?`)} target="_blank" rel="noreferrer">Ask about the next batch →</a>
          </div>
        ) : (
          <div className={styles.calendarScroll}>
            <div className={styles.calendar}>
              {DAYS.map(day => {
                const dayBatches = courseBatches.filter(batch => batch.days.includes(day));
                return (
                  <div className={styles.day} key={day}>
                    <div className={styles.dayHead}>
                      <span>{day}</span>
                      <small>{DAY_LABELS[day]}</small>
                    </div>
                    <div className={styles.dayBody}>
                      {dayBatches.length ? dayBatches.map(batch => {
                        const selectable = canSelect(batch) || batch.status === "waitlist";
                        const isSelected = selectedId === batch.id;
                        return (
                          <div
                            key={`${day}-${batch.id}`}
                            role="button"
                            tabIndex={selectable ? 0 : -1}
                            aria-disabled={!selectable}
                            onClick={() => selectable && setSelectedId(batch.id)}
                            onKeyDown={(e) => {
                              if (selectable && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                setSelectedId(batch.id);
                              }
                            }}
                            className={`${styles.slot} ${isSelected ? styles.slotSelected : ""} ${!selectable ? styles.slotDisabled : ""}`}
                          >
                            <span className={styles.slotTime}>{formatTime(batch.start_time)}</span>
                            <strong>{batch.name}</strong>
                            {batch.level && <small>{batch.level}</small>}
                            <div className={styles.slotFoot}>
                              <span className={`${styles.status} ${styles[`status_${batch.status}`] || ""}`}>{statusText(batch)}</span>
                              {selectable && (
                                <button
                                  type="button"
                                  className={styles.slotEnroll}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEnrollingBatch(batch);
                                  }}
                                >
                                  Enroll now ↗
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }) : <span className={styles.noClass}>—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              key={selected.id}
              className={styles.selection}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: .35 }}
            >
              <div className={styles.selectionLabel}>Your selection</div>
              <div className={styles.selectionMain}>
                <div>
                  <span>{selected.course}{selected.level ? ` · ${selected.level}` : ""}</span>
                  <h3>{selected.name}</h3>
                </div>
                <div className={styles.selectionDetails}>
                  <div><small>Days</small><strong>{selected.days.join(" · ")}</strong></div>
                  <div><small>Time</small><strong>{formatTime(selected.start_time)}–{formatTime(selected.end_time)}</strong></div>
                  <div><small>Availability</small><strong>{statusText(selected)}</strong></div>
                </div>
              </div>
              <div className={styles.selectionBottom}>
                <p>A website selection does not reserve a seat. Yana will confirm the latest availability personally.</p>
                <button
                  type="button"
                  className="button button--accent"
                  onClick={() => setEnrollingBatch(selected)}
                >
                  {selected.status === "waitlist" ? "Join waitlist on WhatsApp" : "Continue on WhatsApp"}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {enrollingBatch && (
        <EnrollModal
          batch={enrollingBatch}
          onClose={() => setEnrollingBatch(null)}
          onSubmit={handleEnrollSubmit}
        />
      )}
    </section>
  );
}
