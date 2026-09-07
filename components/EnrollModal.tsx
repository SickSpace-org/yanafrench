"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { formatTime, statusText, type Batch } from "@/lib/batchData";
import styles from "./EnrollModal.module.css";

export function EnrollModal({
  batch,
  onClose,
  onSubmit,
}: {
  batch: Batch;
  onClose: () => void;
  onSubmit: (details: { name: string; phone: string; email: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !email.trim()) return;
    onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim() });
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
          aria-label="Enroll for this batch"
        >
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>

          <div className={styles.batchTag}>{batch.course}{batch.level ? ` · ${batch.level}` : ""}</div>
          <h3>{batch.name}</h3>
          <p className={styles.batchMeta}>
            {batch.days.join(" · ")} · {formatTime(batch.start_time)}–{formatTime(batch.end_time)} · {statusText(batch)}
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label>
              <span>Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            </label>
            <label>
              <span>Phone number</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9XXXXXXXXX" required />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
            </label>

            <p className={styles.disclaimer}>This does not reserve a seat. Yana will confirm availability on WhatsApp.</p>

            <button type="submit" className={styles.submit}>
              {batch.status === "waitlist" ? "Join waitlist on WhatsApp" : "Continue on WhatsApp"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
