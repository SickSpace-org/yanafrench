"use client";

import { useMemo } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import { usePortalState } from "@/lib/usePortalState";
import { formatDays, formatTime, type Batch, type BatchCourse } from "@/lib/batchData";
import type { Student } from "@/lib/studentData";
import { AdminShell } from "../AdminShell";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import groupStyles from "./AdminGroupsPage.module.css";

type Group = {
  key: string;
  title: string;
  course?: BatchCourse;
  meta?: string;
  students: Student[];
};

// Read-only view of who sits in which batch (admins place students by hand
// from Admin → Students; otherwise it follows payments):
// every verified payment already writes a batch_enrollments row carrying
// the batch id (see lib/enrollment.ts), so grouping the roster by that id
// is the segregation — a new student shows up in their group on the next
// poll. A student with several active batch enrollments appears in each.
function buildGroups(batches: Batch[], students: Student[]): Group[] {
  const byBatch = new Map<string, Student[]>();
  const orphanNames = new Map<string, { name: string; course: BatchCourse }>();
  const unassigned: Student[] = [];

  for (const student of students) {
    const active = student.batchEnrollments.filter((e) => e.status === "active");
    if (active.length === 0) {
      unassigned.push(student);
      continue;
    }
    const seen = new Set<string>();
    for (const e of active) {
      if (seen.has(e.batchId)) continue;
      seen.add(e.batchId);
      const list = byBatch.get(e.batchId) ?? [];
      list.push(student);
      byBatch.set(e.batchId, list);
      if (!orphanNames.has(e.batchId)) orphanNames.set(e.batchId, { name: e.batchName, course: e.course });
    }
  }

  const byName = (a: Student, b: Student) => a.name.localeCompare(b.name);
  const groups: Group[] = batches.map((batch) => ({
    key: batch.id,
    title: batch.name,
    course: batch.course,
    meta: [
      batch.level,
      formatDays(batch.days),
      `${formatTime(batch.start_time)}–${formatTime(batch.end_time)}`,
      batch.published ? null : "Draft",
    ]
      .filter(Boolean)
      .join(" · "),
    students: (byBatch.get(batch.id) ?? []).sort(byName),
  }));

  // Enrollments pointing at a batch that has since been deleted from
  // Admin → Batches — kept visible under the name they paid for.
  const known = new Set(batches.map((b) => b.id));
  for (const [batchId, list] of byBatch) {
    if (known.has(batchId)) continue;
    const info = orphanNames.get(batchId);
    groups.push({
      key: batchId,
      title: info?.name || "Unknown batch",
      course: info?.course,
      meta: "Batch no longer listed in Admin → Batches",
      students: list.sort(byName),
    });
  }

  if (unassigned.length > 0) {
    groups.push({
      key: "__unassigned",
      title: "Not in a batch",
      meta: "Paying students with no active batch enrollment (e.g. recorded-course only)",
      students: unassigned.sort(byName),
    });
  }

  return groups;
}

export function AdminGroupsPage() {
  const { loaded: batchesLoaded, batches } = usePortalState();
  const { items: students, loaded: studentsLoaded } = useAdminCollection<Student>("/api/students");
  const groups = useMemo(() => buildGroups(batches, students), [batches, students]);

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Groups.</h1>
        <p>Every batch with the students enrolled in it. Students are placed automatically from the batch they paid for.</p>
      </div>

      {!batchesLoaded || !studentsLoaded ? (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>Loading…</p>
        </div>
      ) : groups.length === 0 ? (
        <div className={styles.tabPanel}>
          <div className={leadStyles.empty}>No batches yet — create one in Admin → Batches.</div>
        </div>
      ) : (
        <div className={groupStyles.list}>
          {groups.map((group) => (
            <section key={group.key} className={groupStyles.group}>
              <div className={groupStyles.groupHead}>
                <div>
                  <h2 className={groupStyles.groupTitle}>
                    {group.course && <span className={leadStyles.course}>{group.course}</span>}
                    {group.title}
                  </h2>
                  {group.meta && <div className={groupStyles.groupMeta}>{group.meta}</div>}
                </div>
                <span className={groupStyles.count}>
                  {group.students.length} {group.students.length === 1 ? "student" : "students"}
                </span>
              </div>

              {group.students.length === 0 ? (
                <p className={groupStyles.emptyGroup}>No students yet.</p>
              ) : (
                <ul className={groupStyles.students}>
                  {group.students.map((s) => (
                    <li key={s.id} className={groupStyles.student}>
                      <span className={groupStyles.studentName}>{s.name}</span>
                      <span className={groupStyles.studentContact}>
                        <a href={`mailto:${s.email}`}>{s.email}</a>
                        <a href={`tel:${s.phone}`}>{s.phone}</a>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
