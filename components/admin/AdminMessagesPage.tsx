"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import type { Student } from "@/lib/studentData";
import { formatMessageTime, useMessageThread } from "@/lib/useMessageThread";
import { AdminShell } from "../AdminShell";
import styles from "../MessagesPage.module.css";

function initialsFor(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
}

// One student's thread — mounted fresh (via `key` on the caller) each time
// the selected student changes, so useMessageThread's poll/pending state
// never bleeds from one conversation into another.
function ConversationThread({ student }: { student: Student }) {
  const { messages, send } = useMessageThread(student.userId!);
  const [draft, setDraft] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    send(draft);
    setDraft("");
  }

  return (
    <div className={styles.thread}>
      <div className={styles.threadHead}>
        <span className={styles.avatar}>{initialsFor(student.name)}</span>
        <div>
          <strong>{student.name}</strong>
          <small>{student.course}</small>
        </div>
      </div>

      <div className={styles.messages} ref={messagesRef}>
        {messages.map((m) => (
          <div key={m.id} className={m.from === "teacher" ? styles.bubbleStudent : styles.bubbleTeacher}>
            <p>{m.text}</p>
            <span>{formatMessageTime(m.time)}</span>
          </div>
        ))}
      </div>

      <form className={styles.composer} onSubmit={handleSend}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          aria-label="Message"
        />
        <button type="submit" disabled={!draft.trim()}>Send →</button>
      </form>
    </div>
  );
}

// Real per-student conversation list (see lib/messageStore.ts) — no longer
// one hardcoded shared thread. Only students with a linked login
// (userId set — see lib/studentAccount.ts) have a thread to message at
// all; the rest show up disabled with a note instead of being hidden, so
// it's clear why they're not clickable.
export function AdminMessagesPage() {
  const { items: students, loaded } = useAdminCollection<Student>("/api/students");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const messageable = students.filter((s) => s.userId);
  const unlinkedCount = students.length - messageable.length;
  const selected = messageable.find((s) => s.id === selectedId) ?? messageable[0] ?? null;

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Messages.</h1>
      </div>

      <div className={styles.layout}>
        <div className={styles.conversationList}>
          {!loaded ? (
            <p>Loading…</p>
          ) : messageable.length === 0 ? (
            <p>No students with a linked login yet.</p>
          ) : (
            <>
              {messageable.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={selected?.id === s.id ? styles.conversationActive : styles.conversationRow}
                  onClick={() => setSelectedId(s.id)}
                >
                  <span className={styles.avatar}>{initialsFor(s.name)}</span>
                  <div>
                    <strong>{s.name}</strong>
                    <small>{s.course}</small>
                  </div>
                </button>
              ))}
              {unlinkedCount > 0 && (
                <p style={{ fontSize: ".68rem", color: "var(--text-faint)", padding: ".8rem" }}>
                  {unlinkedCount} student{unlinkedCount === 1 ? "" : "s"} without a linked login yet — send them a
                  setup link from Admin → Students first.
                </p>
              )}
            </>
          )}
        </div>

        {selected ? (
          <ConversationThread key={selected.id} student={selected} />
        ) : (
          <div className={styles.thread}>
            <p style={{ padding: "1.4rem" }}>Select a student to view their conversation.</p>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
