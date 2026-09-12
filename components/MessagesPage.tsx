"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { conversation } from "@/lib/messageData";
import { formatMessageTime, useMessageThread } from "@/lib/useMessageThread";
import { DashboardShell } from "./DashboardShell";
import styles from "./MessagesPage.module.css";

export function MessagesPage() {
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
    send(draft);
    setDraft("");
  }

  const initials = conversation.name.split(" ").map((n) => n[0]).join("");

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>LE HUB</small>
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
              <small>{conversation.role}</small>
            </div>
          </div>

          <div className={styles.messages} ref={messagesRef}>
            {messages.map((m) => (
              <div key={m.id} className={m.from === "student" ? styles.bubbleStudent : styles.bubbleTeacher}>
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
    </DashboardShell>
  );
}
