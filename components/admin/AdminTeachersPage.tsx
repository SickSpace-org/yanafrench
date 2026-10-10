"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import { usePortalState } from "@/lib/usePortalState";
import { formatSchedule } from "@/lib/batchData";
import type { AdminTeacher } from "@/lib/teacherData";
import type { AuditEntry } from "@/lib/teacherAudit";
import { ADMIN_BATCH_LABEL } from "@/lib/useBatchTeacherNames";
import { AdminShell } from "../AdminShell";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import groupStyles from "./AdminGroupsPage.module.css";

const CONTENT_LABELS: Record<AuditEntry["contentType"], string> = {
  class_link: "Class link",
  recording: "Recording",
  material: "File",
  announcement: "Announcement",
};

function formatStamp(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

// Everything this teacher created, changed or deleted (teacher_content_audit).
function TeacherActivity({ teacherId, batchName }: { teacherId: string; batchName: (id: string) => string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/teachers/${encodeURIComponent(teacherId)}/activity`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: AuditEntry[]) => !cancelled && setEntries(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  if (failed) return <p className={leadStyles.muted}>Couldn&rsquo;t load activity.</p>;
  if (!entries) return <p className={leadStyles.muted}>Loading activity…</p>;
  if (entries.length === 0) return <p className={leadStyles.muted}>Nothing yet.</p>;
  return (
    <ul className={groupStyles.students}>
      {entries.map((e) => (
        <li key={e.id} className={groupStyles.student}>
          <span>
            <strong>{CONTENT_LABELS[e.contentType]} {e.action}</strong>
            {e.title ? ` — ${e.title}` : ""}
            {e.detail ? <span className={leadStyles.muted}> · {e.detail}</span> : null}
          </span>
          <span className={leadStyles.muted}>
            {batchName(e.batchId)} · {formatStamp(e.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Admin -> Teachers: add a teacher by email (they get a one-time setup
// link), pause or remove them, and decide which batches each one runs. A
// batch with no teacher stays with Yana. See app/api/teachers and
// app/api/batch-teachers.
export function AdminTeachersPage() {
  const { items: teachers, loaded, remove, refresh } = useAdminCollection<AdminTeacher>("/api/teachers");
  const { loaded: batchesLoaded, batches } = usePortalState();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openActivity, setOpenActivity] = useState<string | null>(null);

  async function addTeacher(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    setNotice(null);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      if (!res.ok) {
        setNotice({ ok: false, text: (await res.text().catch(() => "")) || "Couldn't add the teacher." });
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.invited) {
        setNotice({ ok: true, text: `Added ${fullName.trim()} — their setup link is on its way to ${email.trim().toLowerCase()}.` });
      } else {
        setNotice({ ok: false, text: data?.message || "Teacher saved, but the invite failed — use Resend invite." });
      }
      setFullName("");
      setEmail("");
    } catch {
      setNotice({ ok: false, text: "Couldn't add the teacher." });
    } finally {
      setAdding(false);
      refresh();
    }
  }

  async function act(id: string, run: () => Promise<Response>, success: string) {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await run();
      if (!res.ok) setNotice({ ok: false, text: (await res.text().catch(() => "")) || "Something went wrong." });
      else setNotice({ ok: true, text: success });
    } catch {
      setNotice({ ok: false, text: "Something went wrong." });
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  const resendInvite = (t: AdminTeacher) =>
    act(t.id, () => fetch(`/api/teachers/${t.id}/resend-invite`, { method: "POST" }), `A new setup link is on its way to ${t.email}.`);

  const setStatus = (t: AdminTeacher, status: "active" | "deactivated") =>
    act(
      t.id,
      () => fetch(`/api/teachers/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
      status === "active" ? `${t.fullName} can use the teacher portal again.` : `${t.fullName}'s portal access is paused.`
    );

  const assign = (batchId: string, teacherId: string) =>
    act(
      batchId,
      () => fetch("/api/batch-teachers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, teacherId: teacherId || null }) }),
      "Batch teacher updated."
    );

  const teacherOf = (batchId: string) => teachers.find((t) => t.batchIds.includes(batchId));
  const batchName = (id: string) => batches.find((b) => b.id === id)?.name ?? "Unknown batch";

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Teachers.</h1>
        <p>Add a teacher by email — they get a one-time link to set their own password, then sign in on the normal login page. A batch with no teacher stays with you.</p>
      </div>

      <div className={styles.tabPanel}>
        <form className={styles.form} onSubmit={addTeacher}>
          <h2>Add a teacher</h2>
          <div className={styles.fieldGrid}>
            <label>
              Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
          </div>
          <button type="submit" className={styles.save} disabled={adding}>
            {adding ? "Adding…" : "Add & send setup link"}
          </button>
        </form>

        {notice && <p className={notice.ok ? leadStyles.banner : leadStyles.confirmError}>{notice.text}</p>}

        {!loaded ? (
          <p className={styles.tabHint}>Loading…</p>
        ) : teachers.length === 0 ? (
          <div className={leadStyles.empty}>No teachers yet.</div>
        ) : (
          <table className={leadStyles.table}>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Status</th>
                <th>Batches</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <Fragment key={t.id}>
                <tr>
                  <td className={leadStyles.contact}>
                    <strong>{t.fullName}</strong>
                    <div><a href={`mailto:${t.email}`}>{t.email}</a></div>
                  </td>
                  <td>
                    {t.status === "active" ? (
                      <span className={`${leadStyles.payment} ${leadStyles.payment_paid}`}>Active</span>
                    ) : (
                      <span className={`${leadStyles.payment} ${leadStyles.payment_failed}`}>Paused</span>
                    )}
                    {!t.userId && <div className={leadStyles.muted}>Invite not sent</div>}
                  </td>
                  <td>
                    {t.batchIds.length === 0 ? (
                      <span className={leadStyles.muted}>No batches</span>
                    ) : (
                      t.batchIds.map((id) => <div key={id}>{batchName(id)}</div>)
                    )}
                  </td>
                  <td>
                    <div className={leadStyles.actions}>
                      <button type="button" className={leadStyles.action} onClick={() => setOpenActivity(openActivity === t.id ? null : t.id)}>
                        {openActivity === t.id ? "Hide activity" : "Activity"}
                      </button>
                      {t.status === "active" && (
                        <button type="button" className={leadStyles.action} disabled={busyId === t.id} onClick={() => resendInvite(t)}>
                          {t.userId ? "Resend setup link" : "Send setup link"}
                        </button>
                      )}
                      <button
                        type="button"
                        className={leadStyles.action}
                        disabled={busyId === t.id}
                        onClick={() => setStatus(t, t.status === "active" ? "deactivated" : "active")}
                      >
                        {t.status === "active" ? "Pause access" : "Restore access"}
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={leadStyles.remove}
                      onClick={() => {
                        if (window.confirm(`Remove ${t.fullName}? Their login is deleted and their batches go back to you.`)) remove(t.id);
                      }}
                    >
                      Remove teacher
                    </button>
                  </td>
                </tr>
                {openActivity === t.id && (
                  <tr>
                    <td colSpan={5}>
                      <TeacherActivity teacherId={t.id} batchName={batchName} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.head} style={{ marginTop: "2.4rem" }}>
        <h1 style={{ fontSize: "1.4rem" }}>Who teaches each batch.</h1>
        <p>One teacher per batch. Renaming a batch keeps its teacher; deleting a batch clears it.</p>
      </div>

      {!batchesLoaded ? (
        <p className={styles.tabHint}>Loading…</p>
      ) : batches.length === 0 ? (
        <div className={leadStyles.empty}>No batches yet — create one in Admin → Batches.</div>
      ) : (
        <div className={groupStyles.list}>
          {batches.map((b) => {
            const current = teacherOf(b.id);
            return (
              <section key={b.id} className={groupStyles.group}>
                <div className={groupStyles.groupHead}>
                  <div>
                    <h2 className={groupStyles.groupTitle}>
                      <span className={leadStyles.course}>{b.course}</span>
                      {b.name}
                    </h2>
                    <div className={groupStyles.groupMeta}>
                      {[b.level, formatSchedule(b), b.published ? null : "Draft"]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <label className={leadStyles.confirmBox}>
                    <select
                      aria-label={`Teacher for ${b.name}`}
                      value={current?.id ?? ""}
                      disabled={!loaded || busyId === b.id}
                      onChange={(e) => assign(b.id, e.target.value)}
                    >
                      <option value="">{ADMIN_BATCH_LABEL}</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                          {t.status === "active" ? "" : " (paused)"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
