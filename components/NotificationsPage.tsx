"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { NotificationType } from "@/lib/notificationData";
import { useStudentNotifications } from "@/lib/useStudentNotifications";
import { DashboardShell } from "./DashboardShell";
import styles from "./NotificationsPage.module.css";

const typeLabels: Record<NotificationType, string> = {
  assignment: "Homework",
  feedback: "New feedback",
  payment: "EMI payment",
  message: "Message",
  announcement: "Announcement",
};

export function NotificationsPage() {
  const { loaded, items } = useStudentNotifications();

  // Opening this page counts as reading the announcements: this visit still
  // shows them as new, and the dot is gone from the next page on.
  useEffect(() => {
    if (loaded && items.some((n) => n.type === "announcement" && !n.read)) {
      fetch("/api/student/announcements", { method: "POST" }).catch(() => {});
    }
  }, [loaded, items]);

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>LE HUB</small>
        <h1>Notifications.</h1>
      </div>

      {loaded && items.length === 0 ? (
        <p className={styles.empty}>You&apos;re all caught up. New homework, feedback, EMI reminders, announcements and messages from Yana will show up here.</p>
      ) : (
        <div className={styles.list}>
          {items.map((n) => (
            <Link key={n.id} href={n.href} className={n.read ? styles.item : `${styles.item} ${styles.itemUnread}`}>
              {!n.read && <span className={styles.unreadDot} aria-hidden="true" />}
              <div>
                <span className={styles.type}>{typeLabels[n.type].toUpperCase()}</span>
                <strong>{n.title}</strong>
                <small className={n.type === "announcement" ? styles.fullText : undefined}>{n.detail}</small>
              </div>
              <span className={styles.date}>{n.date}</span>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
