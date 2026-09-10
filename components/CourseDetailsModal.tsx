"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import type { Course } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";
import enrollStyles from "./EnrollModal.module.css";
import styles from "./CourseModals.module.css";

export function CourseDetailsModal({
  course,
  onClose,
  onEnroll,
}: {
  course: Course;
  onClose: () => void;
  onEnroll: () => void;
}) {
  useEffect(() => {
    document.body.classList.add("enroll-modal-open");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("enroll-modal-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      className={enrollStyles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={`${enrollStyles.card} ${styles.detailsCard}`}
        initial={{ opacity: 0, y: 18, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: .98 }}
        transition={{ duration: .25 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${course.title} details`}
      >
        <button type="button" className={enrollStyles.close} onClick={onClose} aria-label="Close">×</button>

        <span className={enrollStyles.batchTag}>{course.category}</span>
        <h3>{course.title}</h3>
        <p className={styles.detailsSubline}>
          {[course.level, course.duration].filter(Boolean).join(" • ")}
        </p>
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatRupees(course.priceInPaise)}</span>
          {course.regularPriceInPaise !== undefined && (
            <span className={styles.regularPrice}>{formatRupees(course.regularPriceInPaise)}</span>
          )}
          {course.savingsInPaise !== undefined && (
            <span className={styles.savings}>Save {formatRupees(course.savingsInPaise)}</span>
          )}
        </div>

        <div className={styles.factsRow}>
          {course.minimumLevel && <span><small>Minimum Level</small>{course.minimumLevel}</span>}
          <span><small>Duration</small>{course.duration}</span>
          {course.maxDuration && <span><small>Maximum Duration</small>{course.maxDuration}</span>}
          {course.classes !== undefined && <span><small>Classes</small>{course.classes}</span>}
          <span><small>Mode</small>{course.mode}</span>
        </div>

        <section className={styles.section}>
          <h4>Course Overview</h4>
          <p>{course.overview}</p>
        </section>

        <section className={styles.section}>
          <h4>What You&apos;ll Learn</h4>
          <ul className={styles.checkList}>
            {course.whatYouLearn.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className={styles.section}>
          <h4>Course Includes</h4>
          <ul className={styles.checkList}>
            {course.includes.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        {course.target && (
          <section className={styles.section}>
            <h4>Target</h4>
            <p>{course.target}</p>
          </section>
        )}

        <button type="button" className={`button button--accent ${styles.enrollCta}`} onClick={onEnroll}>
          Enroll Now →
        </button>
      </motion.div>
    </motion.div>
  );
}
