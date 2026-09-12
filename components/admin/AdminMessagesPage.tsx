"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatMessageTime, useMessageThread } from "@/lib/useMessageThread";
import { AdminShell } from "../AdminShell";
import styles from "../MessagesPage.module.css";

// Placeholder conversation label — the thread itself is still one single
// global conversation shared by every student (see lib/useMessageThread.ts),
// not yet split per student. Fixing that is a separate, larger change.
const conversation = { name: "Student", course: "—" };

// Same shared, R2-backed thread as the student's Messages page (see
// lib/useMessageThread.ts and app/api/messages/route.ts) — sending here as
// "teacher" so it shows up on the student's side immediately, polling both
// ways. Bubble sides are swapped from the student view: the admin's own
// ("teacher") messages render on the right.
export function AdminMessagesPage() {
  const { messages, send } = useMessageThread();
  const [draft, setDraft] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    send("teacher", draft);
    setDraft("");
  }

  const initials = conversation.name.slice(0, 2).toUpperCase();

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Messages.</h1>
      </div>

      <div className={styles.layout}>
        <div className={styles.conversationList}>
          <div className={styles.conversationActive}>
            <span className={styles.avatar}>{initials}</span>
            <div>
              <strong>{conversation.name}</strong>
              <small>{messages[messages.length - 1]?.text.slice(0, 34)}…</small>
            </div>
          </div>
        </div>

        <div className={styles.thread}>
          <div className={styles.threadHead}>
            <span className={styles.avatar}>{initials}</span>
            <div>
              <strong>{conversation.name}</strong>
              <small>{conversation.course}</small>
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
      </div>
    </AdminShell>
  );
}
