"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ANNOUNCEMENT_MAX_CHARS, type Announcement } from "@/lib/announcementData";
import admin from "./admin/AdminLessonsManager.module.css";
import leadStyles from "./admin/AdminLeadsPanel.module.css";
import groupStyles from "./admin/AdminGroupsPage.module.css";

// Compose + sent list for one batch's announcements — shared by the teacher
// portal (/api/teacher/announcements, own announcements only) and Admin ->
// Announcements (/api/announcements, every announcement, with delete).
// Students read them in their Notifications.

function formatStamp(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

export function AnnouncementsPanel({
  batchId,
  endpoint,
  recipients,
  canDelete = false,
}: {
  batchId: string;
  endpoint: string;
  recipients: { id: string; name: string }[] | null;
  canDelete?: boolean;
}) {
  const [list, setList] = useState<Announcement[] | null>(null);
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${endpoint}?batchId=${encodeURIComponent(batchId)}`, { cache: "no-store" });
      if (res.ok) setList(await res.json());
    } catch {
      // keep what's shown
    }
  }, [batchId, endpoint]);

  useEffect(() => {
    setList(null);
    setTo("");
    setNotice(null);
    load();
  }, [load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const recipient = to ? recipients?.find((r) => r.id === to)?.name ?? "this student" : "the whole batch";
    if (!window.confirm(`Send this to ${recipient}? Announcements can't be edited after sending.`)) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, studentId: to || null, body }),
      });
      if (!res.ok) {
        setNotice({ ok: false, text: (await res.text().catch(() => "")) || "Couldn't send the announcement." });
        return;
      }
      setBody("");
      setNotice({ ok: true, text: `Sent to ${recipient} — it shows in their Notifications.` });
    } catch {
      setNotice({ ok: false, text: "Couldn't send the announcement." });
    } finally {
      setSending(false);
      load();
    }
  }

  async function remove(a: Announcement) {
    if (!window.confirm("Delete this announcement? Students will no longer see it.")) return;
    const res = await fetch(`${endpoint}/${encodeURIComponent(a.id)}`, { method: "DELETE" });
    setNotice(res.ok ? { ok: true, text: "Announcement deleted." } : { ok: false, text: "Couldn't delete the announcement." });
    load();
  }

  return (
    <>
      <form className={admin.form} onSubmit={send}>
        <h2>New announcement</h2>
        <div className={admin.fieldGrid}>
          <label>
            To
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Whole batch</option>
              {(recipients ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
        </div>
        <label className={admin.fullWidth}>
          Message
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required maxLength={ANNOUNCEMENT_MAX_CHARS} rows={4} />
        </label>
        <button type="submit" className={admin.save} disabled={sending || !body.trim()}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>

      {notice && <p className={notice.ok ? leadStyles.banner : leadStyles.confirmError}>{notice.text}</p>}

      {list === null ? (
        <p className={leadStyles.muted}>Loading…</p>
      ) : list.length === 0 ? (
        <div className={leadStyles.empty}>Nothing sent to this batch yet.</div>
      ) : (
        <ul className={groupStyles.students}>
          {list.map((a) => (
            <li key={a.id} className={groupStyles.student} style={{ alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                <div className={leadStyles.muted}>
                  {a.senderName} → {a.studentId ? a.studentName ?? "one student" : "whole batch"} · {formatStamp(a.createdAt)}
                </div>
                <div style={{ whiteSpace: "pre-line" }}>{a.body}</div>
              </div>
              {canDelete && (
                <button type="button" className={leadStyles.remove} onClick={() => remove(a)}>Delete</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
