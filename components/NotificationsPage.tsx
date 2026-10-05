"use client";

import Link from "next/link";
import type { NotificationType } from "@/lib/notificationData";
import { useStudentNotifications } from "@/lib/useStudentNotifications";
import { DashboardShell } from "./DashboardShell";
import styles from "./NotificationsPage.module.css";

const typeLabels: Record<NotificationType, string> = {
  assignment: "Homework",
  feedback: "New feedback",
  payment: "EMI payment",
  message: "Message",
};

export function NotificationsPage() {
  const { loaded, items } = useStudentNotifications();

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>LE HUB</small>
        <h1>Notifications.</h1>
      </div>

      {loaded && items.length === 0 ? (
        <p className={styles.empty}>You&apos;re all caught up. New homework, feedback, EMI reminders and messages from Yana will show up here.</p>
      ) : (
        <div className={styles.list}>
          {items.map((n) => (
            <Link key={n.id} href={n.href} className={n.read ? styles.item : `${styles.item} ${styles.itemUnread}`}>
              {!n.read && <span className={styles.unreadDot} aria-hidden="true" />}
              <div>
                <span className={styles.type}>{typeLabels[n.type].toUpperCase()}</span>
                <strong>{n.title}</strong>
                <small>{n.detail}</small>
              </div>
              <span className={styles.date}>{n.date}</span>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
