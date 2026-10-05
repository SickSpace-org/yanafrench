import { daysBetween, EMI_REMINDER_DAYS_BEFORE, formatIndiaDate, isoToIndiaDate, type EmiInstallment } from "./emiData";
import { formatRupees } from "./formatCurrency";

export type NotificationType = "assignment" | "feedback" | "payment" | "message";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  detail: string;
  date: string;
  href: string;
  // Unread = still needs the student's attention (homework to do, an EMI
  // coming due); everything else is informational.
  read: boolean;
  sortKey: number;
};

// The slices of /api/student/homework, /api/student/emi and /api/messages
// that notifications are built from.
export type NotificationHomework = {
  id: string;
  title: string;
  dueDate: string | null;
  createdAt: string;
  submission: { feedback: unknown; updatedAt?: string; submittedAt?: string } | null;
};
export type NotificationMessage = { id: string; from: "student" | "teacher"; text: string; time: number };

export function relativeDate(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatIndiaDate(isoToIndiaDate(iso));
}

// Everything here comes from the student's own records — there is no
// stored notification feed, so nothing can be stale or made up.
export function buildNotifications(input: {
  homework: NotificationHomework[];
  installments: EmiInstallment[];
  messages: NotificationMessage[];
  today: string;
  now?: number;
}): Notification[] {
  const now = input.now ?? Date.now();
  const items: Notification[] = [];

  for (const hw of input.homework) {
    if (!hw.submission) {
      items.push({
        id: `hw-${hw.id}`,
        type: "assignment",
        title: "New homework",
        detail: hw.dueDate ? `${hw.title} · due ${formatIndiaDate(hw.dueDate)}` : hw.title,
        date: relativeDate(hw.createdAt, now),
        href: "/student-hub/homework",
        read: false,
        sortKey: new Date(hw.createdAt).getTime(),
      });
    } else if (hw.submission.feedback) {
      const at = hw.submission.updatedAt ?? hw.submission.submittedAt ?? hw.createdAt;
      items.push({
        id: `hwfb-${hw.id}`,
        type: "feedback",
        title: "Homework feedback ready",
        detail: hw.title,
        date: relativeDate(at, now),
        href: "/student-hub/homework",
        read: true,
        sortKey: new Date(at).getTime(),
      });
    }
  }

  for (const inst of input.installments) {
    if (inst.status !== "pending") continue;
    const daysLeft = daysBetween(input.today, inst.dueDate);
    if (daysLeft > EMI_REMINDER_DAYS_BEFORE) continue;
    items.push({
      id: `emi-${inst.id}`,
      type: "payment",
      title: daysLeft < 0 ? "EMI overdue" : daysLeft === 0 ? "EMI due today" : `EMI due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      detail: `${inst.productTitle} · EMI ${inst.installmentNo} of ${inst.installmentCount} · ${formatRupees(inst.amount)}`,
      date: formatIndiaDate(inst.dueDate),
      href: "/student-hub/pay-emi",
      read: false,
      // Payment reminders always sit at the top.
      sortKey: Number.MAX_SAFE_INTEGER - daysLeft,
    });
  }

  const lastFromYana = [...input.messages].reverse().find((m) => m.from === "teacher");
  if (lastFromYana) {
    items.push({
      id: `msg-${lastFromYana.id}`,
      type: "message",
      title: "Message from Yana",
      detail: lastFromYana.text.length > 90 ? `${lastFromYana.text.slice(0, 90)}…` : lastFromYana.text,
      date: relativeDate(new Date(lastFromYana.time).toISOString(), now),
      href: "/student-hub/messages",
      read: true,
      sortKey: lastFromYana.time,
    });
  }

  return items.sort((a, b) => b.sortKey - a.sortKey);
}
