"use client";

import { useEffect, useState } from "react";
import { formatSchedule } from "@/lib/batchData";
import { formatIndiaDate } from "@/lib/emiData";
import type { RosterStudent } from "@/lib/teacherData";
import { useTeacherMe } from "@/lib/useTeacherMe";
import styles from "./TeacherPortal.module.css";


// The teacher's home: the batches Yana has assigned them (app/api/teacher/me),
// each with its roster (app/api/teacher/batches/[batchId]/students).
// Attendance and class links arrive in later phases.

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// Each batch loads its own roster, so one failing batch doesn't blank the rest.
function Roster({ batchId }: { batchId: string }) {
  const [students, setStudents] = useState<RosterStudent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/teacher/batches/${encodeURIComponent(batchId)}/students`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { students: RosterStudent[] }) => !cancelled && setStudents(data.students))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  if (failed) return <p className={styles.meta}>Couldn&rsquo;t load the students for this batch.</p>;
  if (!students) return <p className={styles.meta}>Loading students…</p>;
  if (students.length === 0) return <p className={styles.meta}>No students in this batch yet.</p>;

  return (
    <>
      <div className={styles.count}>
        {students.length} {students.length === 1 ? "student" : "students"}
      </div>
      <ul className={styles.roster}>
        {students.map((s) => (
          <li key={s.id} className={styles.student}>
            {s.avatarUrl ? (
              <img src={s.avatarUrl} alt="" className={styles.avatar} referrerPolicy="no-referrer" />
            ) : (
              <span className={styles.avatar} aria-hidden="true">{initials(s.name)}</span>
            )}
            <span>{s.name}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
export function TeacherDashboard() {
  const { me, failed } = useTeacherMe();

  if (failed) return <div className={styles.empty}>Couldn&rsquo;t load your batches. Refresh the page to try again.</div>;
  if (!me) return <p className={styles.meta}>Loading…</p>;

  const firstName = me.teacher.fullName.trim().split(/\s+/)[0];

  return (
    <>
      <div className={styles.head}>
        <small>TEACHER</small>
        <h1>Bonjour, {firstName}.</h1>
        <p>The batches you teach and who&rsquo;s in them. Class times are India time.</p>
      </div>

      {me.batches.length === 0 ? (
        <div className={styles.empty}>No batches assigned to you yet — Yana will assign you one.</div>
      ) : (
        <div className={styles.list}>
          {me.batches.map((b) => (
            <section key={b.id} className={styles.batch}>
              <h2 className={styles.batchTitle}>
                <span className={styles.course}>{b.course}</span>
                {b.name}
              </h2>
              <div className={styles.meta}>
                {[b.level, formatSchedule(b)].filter(Boolean).join(" · ")}
              </div>
              {(b.startDate || b.endDate) && (
                <div className={styles.meta}>
                  {b.startDate ? formatIndiaDate(b.startDate) : "…"} → {b.endDate ? formatIndiaDate(b.endDate) : "ongoing"}
                </div>
              )}
              <Roster batchId={b.id} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
