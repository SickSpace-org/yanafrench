"use client";

import { useEffect, useState } from "react";
import { formatRupees } from "@/lib/formatCurrency";
import { daysOverdue, formatIndiaDate, isoToIndiaDate, lockDate, EMI_GRACE_DAYS, type EmiInstallment } from "@/lib/emiData";
import type { MyCourse } from "@/lib/myCourseData";
import { emiWhatsappMessage } from "@/lib/useStudentEmi";
import { whatsappUrl } from "@/lib/site";
import { DashboardShell } from "./DashboardShell";
import head from "./AttendancePage.module.css";
import styles from "./MyCoursePage.module.css";

type Data = { courses: MyCourse[]; today: string; preview: boolean };

function dueLabel(inst: EmiInstallment, today: string) {
  const d = daysOverdue(inst.dueDate, today);
  if (d < 0) return { text: `Due in ${-d} ${d === -1 ? "day" : "days"}`, warn: false };
  if (d === 0) return { text: "Due today", warn: true };
  if (d <= EMI_GRACE_DAYS) return { text: `Overdue — pay by ${formatIndiaDate(lockDate(inst.dueDate))}`, warn: true };
  return { text: "Overdue", warn: true };
}

// Student hub → My Course: each course the student is enrolled in, how
// much they've paid in total, and their next EMI (with a WhatsApp button
// to pay Yana, who marks it paid in Admin → EMI).
export function MyCoursePage() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/student/my-course", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const courses = data?.courses ?? [];
  const totalPaid = courses.reduce((s, c) => s + c.paidPaise, 0);
  const nextEmi = courses
    .map((c) => c.next)
    .filter((n): n is EmiInstallment => !!n)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
  const hasEmi = courses.some((c) => c.plan === "emi");

  return (
    <DashboardShell>
      <div className={head.head}>
        <small>YOUR ENROLLMENT</small>
        <h1>My Course.</h1>
        <p>Your course, what you&rsquo;ve paid so far, and your next EMI.</p>
      </div>

      {failed ? (
        <p className={head.muted}>Couldn&rsquo;t load your course — please refresh the page.</p>
      ) : !data ? (
        <p className={head.muted}>Loading…</p>
      ) : courses.length === 0 ? (
        <p className={head.muted}>
          {data.preview ? "Admin preview — students see their own course and payments here." : "You're not enrolled in a course yet."}
        </p>
      ) : (
        <>
          <div className={styles.stats}>
            <div>
              <span>Total paid</span>
              <strong>{formatRupees(totalPaid)}</strong>
            </div>
            <div>
              <span>{courses.length === 1 ? "Course" : "Courses"}</span>
              <strong className={styles.statText}>{courses.map((c) => (c.kind === "batch" ? `${c.title} · ${c.detail}` : c.title)).join(", ")}</strong>
            </div>
            <div>
              <span>Next EMI</span>
              {nextEmi ? (
                <>
                  <strong>{formatRupees(nextEmi.amount)}</strong>
                  <em className={dueLabel(nextEmi, data.today).warn ? styles.warn : undefined}>
                    {formatIndiaDate(nextEmi.dueDate)} · {dueLabel(nextEmi, data.today).text}
                  </em>
                </>
              ) : (
                <strong className={styles.statText}>{hasEmi ? "All EMIs paid ✓" : "No EMIs — paid in full"}</strong>
              )}
            </div>
          </div>

          <div className={styles.courses}>
            {courses.map((c) => {
              const remaining = c.feePaise !== null ? Math.max(0, c.feePaise - c.paidPaise) : null;
              const pct = c.feePaise ? Math.min(100, Math.round((c.paidPaise / c.feePaise) * 100)) : null;
              const paidCount = c.installments.filter((i) => i.status === "paid").length;
              return (
                <article key={c.id} className={styles.course}>
                  <header className={styles.courseHead}>
                    <div>
                      <small className={styles.kicker}>{c.kind === "batch" ? `${c.title} BATCH` : "COURSE"}</small>
                      <h2>{c.kind === "batch" ? c.detail : c.title}</h2>
                      <span className={styles.meta}>
                        Enrolled on {formatIndiaDate(isoToIndiaDate(c.enrolledAt))} · {c.plan === "emi" ? `EMI plan (${paidCount} of ${c.installments.length} EMIs paid)` : "Paid in full"}
                      </span>
                    </div>
                  </header>

                  <div className={styles.money}>
                    <div>
                      <span>Paid so far</span>
                      <strong>{formatRupees(c.paidPaise)}</strong>
                    </div>
                    {c.feePaise !== null && (
                      <div>
                        <span>Course fee</span>
                        <strong>{formatRupees(c.feePaise)}</strong>
                      </div>
                    )}
                    {remaining !== null && (
                      <div>
                        <span>Remaining</span>
                        <strong>{remaining === 0 ? "—" : formatRupees(remaining)}</strong>
                      </div>
                    )}
                  </div>
                  {pct !== null && (
                    <div className={styles.bar} role="img" aria-label={`${pct}% of the course fee paid`}>
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  )}

                  {c.installments.length > 0 && (
                    <ul className={styles.schedule}>
                      {c.installments.map((i) => {
                        const isNext = c.next?.id === i.id;
                        const due = dueLabel(i, data.today);
                        return (
                          <li key={i.id} className={i.status === "paid" ? styles.paid : isNext ? styles.next : undefined}>
                            <span>EMI {i.installmentNo}</span>
                            <span>{formatIndiaDate(i.dueDate)}</span>
                            <span>{formatRupees(i.amount)}</span>
                            <span>
                              {i.status === "paid"
                                ? `Paid${i.paidAt ? ` ${formatIndiaDate(isoToIndiaDate(i.paidAt))}` : ""} ✓`
                                : isNext
                                  ? <em className={due.warn ? styles.warn : undefined}>{due.text}</em>
                                  : "Upcoming"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {c.next && (
                    <div className={styles.payRow}>
                      <a className={styles.pay} href={whatsappUrl(emiWhatsappMessage(c.next))} target="_blank" rel="noreferrer">
                        Pay next EMI on WhatsApp · {formatRupees(c.next.amount)}
                      </a>
                      <span>It shows as paid here once Yana confirms it.</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
