"use client";

import { useMemo, useState } from "react";
import { generateClassEvents, formatTime, DAY_LABELS, type Batch, type BatchCourse, type ClassEvent } from "@/lib/batchData";
import { cancellationKey, type ClassCancellation } from "@/lib/attendanceData";
import { usePortalState } from "@/lib/usePortalState";
import { joinClassUrl, useClassLinks } from "@/lib/useClassLinks";
import { classDateKey, useClassCancellations } from "@/lib/useClassCancellations";
import { ClassLinkLine } from "./ClassLinkLine";
import { useStudentProfile } from "@/lib/useStudentProfile";
import { DashboardShell } from "./DashboardShell";
import styles from "./CalendarPage.module.css";

type CategoryFilter = "All" | BatchCourse;
const CATEGORIES: CategoryFilter[] = ["All", "TEF", "TCF", "DELF"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function BatchCard({
  batch,
  zoomLink,
  isYours,
  link,
  cancellations,
}: {
  batch: Batch;
  zoomLink: string;
  isYours: boolean;
  link: string;
  cancellations: Map<string, ClassCancellation>;
}) {
  const events = useMemo(() => generateClassEvents(batch, zoomLink, 30), [batch, zoomLink]);
  const cancelledFor = (e: ClassEvent) => cancellations.get(cancellationKey(e.batchId, classDateKey(e.date)));
  const next = events.find((e) => !cancelledFor(e)) ?? null;
  const cancelled = events.filter((e) => cancelledFor(e));

  return (
    <div className={styles.batchCard}>
      <div className={styles.batchTop}>
        <span className={styles.batchCourse}>{batch.course.toUpperCase()}</span>
        {batch.level && <span className={styles.batchLevel}>{batch.level}</span>}
        {isYours && <span className={styles.mainBadge}>Your batch</span>}
      </div>
      <strong>{batch.name}</strong>
      {batch.slots.map((slot) => (
        <small key={slot.days.join("")}>
          {slot.days.map((d) => DAY_LABELS[d] ?? d).join(" · ")} · {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
        </small>
      ))}
      {cancelled.map((e) => {
        const note = cancelledFor(e)?.note;
        return (
          <small key={e.id} className={styles.cancelledClass}>
            Cancelled: {e.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            {note && <span> · {note}</span>}
          </small>
        );
      })}
      {next && (
        <small className={styles.nextClass}>
          Next class: {next.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </small>
      )}
      {link && (
        <>
          <a href={joinClassUrl(batch.id)} target="_blank" rel="noreferrer" className={styles.joinLink}>Join class →</a>
          {isYours && <ClassLinkLine url={link} />}
        </>
      )}
    </div>
  );
}

export function CalendarPage() {
  const { batches, zoomLink } = usePortalState();
  const classLinks = useClassLinks();
  const cancellations = useClassCancellations();
  const profile = useStudentProfile();
  // A real student's own enrolled batches (see lib/batchEnrollmentData.ts —
  // one person can hold more than one) — falls back to the admin's
  // sitewide "current" pick only for an admin previewing the hub, who has
  // no enrolled batch of their own.
  const myBatchIds = useMemo(
    () => (profile.kind === "student" ? new Set(profile.student.batchEnrollments.map((e) => e.batchId)) : null),
    [profile]
  );
  const isMine = (b: Batch) => (myBatchIds ? myBatchIds.has(b.id) : b.isCurrent);
  const [category, setCategory] = useState<CategoryFilter>("All");

  // Every published batch for the selected course — not just the
  // student's own — so a batch shows up here the moment it's published,
  // with no separate step required — plus the student's own batch(es),
  // published or not (private per-student batches), sorted first.
  const visibleBatches = useMemo(
    () =>
      batches
        .filter((b) => (b.published || isMine(b)) && (category === "All" || b.course === category))
        .sort((a, b) => Number(isMine(b)) - Number(isMine(a))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [batches, category, myBatchIds]
  );

  // Only drives the dots on the grid — the batches themselves (not
  // per-occurrence entries) are what the agenda now lists. A day whose
  // classes are all cancelled gets a hollow dot.
  const classDays = useMemo(
    () =>
      visibleBatches.flatMap((b) =>
        generateClassEvents(b, zoomLink, 45).map((e) => ({ date: e.date, cancelled: cancellations.has(cancellationKey(e.batchId, classDateKey(e.date))) }))
      ),
    [visibleBatches, zoomLink, cancellations]
  );

  const today = useMemo(() => new Date(), []);
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthLabel = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstOfMonth.getDay();

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const classesOn = (day: Date) => classDays.filter((c) => isSameDay(c.date, day));

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>LE HUB</small>
        <h1>Calendar.</h1>
      </div>

      <div className={styles.categoryRow} role="tablist" aria-label="Filter by course">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            className={category === c ? styles.chipActive : styles.chip}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <div className={styles.calendarCard}>
          <div className={styles.calendarHead}>
            <strong>{monthLabel}</strong>
          </div>
          <div className={styles.weekdays}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <span key={i} className={styles.emptyCell} />;
              const isToday = isSameDay(day, today);
              const classes = classesOn(day);
              const allCancelled = classes.length > 0 && classes.every((c) => c.cancelled);
              return (
                <div key={i} className={`${styles.cell} ${isToday ? styles.cellToday : ""}`} title={allCancelled ? "Class cancelled" : undefined}>
                  <span>{day.getDate()}</span>
                  {classes.length > 0 && (
                    <div className={styles.dots}>
                      <i className={allCancelled ? styles.dotCancelled : undefined} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.agenda}>
          <h2>Your batches</h2>
          {visibleBatches.length > 0 ? (
            <div className={styles.list}>
              {visibleBatches.map((b) => (
                <BatchCard key={b.id} batch={b} zoomLink={zoomLink} isYours={isMine(b)} link={classLinks[b.id] ?? ""} cancellations={cancellations} />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p>{category === "All" ? "No batches published yet — ask your teacher." : `No ${category} batch published yet.`}</p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
