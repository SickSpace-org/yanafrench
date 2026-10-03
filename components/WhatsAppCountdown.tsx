"use client";

import { useEffect, useState } from "react";
import { site, whatsappUrl } from "@/lib/site";
import styles from "./WhatsAppCountdown.module.css";

const SECONDS = 3;
const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Shown on the enroll forms' thank-you screen: counts down 3 seconds, then
// opens Yana's WhatsApp chat (same tab — a new tab opened from a timer,
// with no click behind it, gets blocked as a popup). "Stay here" cancels.
export function WhatsAppCountdown({ message }: { message: string }) {
  const [left, setLeft] = useState(SECONDS);
  const [cancelled, setCancelled] = useState(false);
  const href = whatsappUrl(message);
  const tutor = site.tutor.split(" ")[0];

  useEffect(() => {
    if (cancelled) return;
    if (left <= 0) {
      window.location.assign(href);
      return;
    }
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, cancelled, href]);

  if (cancelled) {
    return (
      <a className={styles.openNow} href={href}>
        Open {tutor}&apos;s WhatsApp
      </a>
    );
  }

  return (
    <div className={styles.box} role="status" aria-live="polite">
      <div className={styles.ring}>
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle className={styles.track} cx="32" cy="32" r={RADIUS} />
          <circle
            className={styles.progress}
            cx="32"
            cy="32"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - left / SECONDS)}
          />
        </svg>
        <span className={styles.count}>{Math.max(left, 0)}</span>
      </div>
      <div className={styles.text}>
        <strong>{left > 0 ? `Opening ${tutor}'s WhatsApp in ${left}…` : `Opening ${tutor}'s WhatsApp…`}</strong>
        <span>Your enrollment message is ready to send.</span>
        <div className={styles.links}>
          <a href={href}>Open now</a>
          <button type="button" onClick={() => setCancelled(true)}>
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}
