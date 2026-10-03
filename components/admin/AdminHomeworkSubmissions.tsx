"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatIndiaDate, isoToIndiaDate } from "@/lib/emiData";
import type { Homework, HomeworkSubmission } from "@/lib/homeworkData";
import { HomeworkCard } from "../HomeworkCard";
import { FeedbackSummary, TaskFeedback } from "../HomeworkFeedback";
import card from "../HomeworkCard.module.css";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import own from "./AdminHomeworkPage.module.css";

type Row = { studentId: string; name: string; email: string; inBatch: boolean; submission: HomeworkSubmission | null };

const POLL_MS = 10_000;

function formatWhen(iso: string) {
  return `${formatIndiaDate(isoToIndiaDate(iso))}, ${new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso))}`;
}

// Who a homework went to, who has submitted, and each student's answers
// laid out under the tasks they answer.
export function AdminHomeworkSubmissions({ homeworkId, onClose }: { homeworkId: string; onClose: () => void }) {
  const [data, setData] = useState<{ homework: Homework; students: Row[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [homeworkId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/homework/${encodeURIComponent(homeworkId)}/submissions`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [homeworkId]);

  useEffect(() => {
    setData(null);
    setSelected(null);
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Default to the first student who has submitted.
  useEffect(() => {
    if (!data || selected) return;
    const first = data.students.find((s) => s.submission) ?? data.students[0];
    if (first) setSelected(first.studentId);
  }, [data, selected]);

  const submitted = data?.students.filter((s) => s.submission).length ?? 0;
  const current = data?.students.find((s) => s.studentId === selected) ?? null;

  return (
    <section ref={panelRef} className={own.subsPanel}>
      <div className={own.subsHead}>
        <div>
          <span className={styles.sectionLabel}>SUBMISSIONS</span>
          <h3 className={own.subsTitle}>{data?.homework.title ?? "Loading…"}</h3>
          {data && (
            <div className={leadStyles.time}>
              {submitted} of {data.students.filter((s) => s.inBatch).length} submitted
            </div>
          )}
        </div>
        <button type="button" className={styles.linkToggle} onClick={onClose}>
          Close
        </button>
      </div>

      {failed && !data ? (
        <p className={styles.uploadError}>Couldn&rsquo;t load submissions.</p>
      ) : !data ? (
        <p className={styles.tabHint}>Loading…</p>
      ) : data.students.length === 0 ? (
        <div className={leadStyles.empty}>No students are enrolled in these batches yet.</div>
      ) : (
        <div className={own.subsBody}>
          <ul className={own.subsList}>
            {data.students.map((s) => (
              <li key={s.studentId}>
                <button
                  type="button"
                  className={s.studentId === selected ? own.subsStudentOn : own.subsStudent}
                  onClick={() => setSelected(s.studentId)}
                >
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.inBatch ? s.email : "No longer in this batch"}</small>
                  </span>
                  {s.submission ? (
                    <span className={`${leadStyles.payment} ${leadStyles.payment_paid}`}>Submitted</span>
                  ) : (
                    <span className={`${leadStyles.payment} ${leadStyles.payment_failed}`}>Not yet</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className={own.subsAnswers}>
            {!current ? null : !current.submission ? (
              <div className={leadStyles.empty}>{current.name} hasn&rsquo;t submitted this homework yet.</div>
            ) : (
              <HomeworkCard
                homework={data.homework}
                dueDate={data.homework.dueDate}
                actions={
                  <span className={leadStyles.time}>
                    {current.name} · {formatWhen(current.submission.updatedAt)}
                    {current.submission.updatedAt !== current.submission.submittedAt ? " (resubmitted)" : ""}
                  </span>
                }
                renderTask={(s, t) => {
                  const answer = current.submission!.answers[s]?.[t];
                  return answer ? (
                    <>
                      <div className={card.answer}>{answer}</div>
                      <TaskFeedback item={current.submission!.feedback?.items[s]?.[t]} />
                    </>
                  ) : (
                    <span className={card.noAnswer}>No answer</span>
                  );
                }}
              >
                {current.submission.feedback && <FeedbackSummary feedback={current.submission.feedback} />}
              </HomeworkCard>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
