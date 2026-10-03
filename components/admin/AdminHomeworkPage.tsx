"use client";

import { useState } from "react";
import { useAdminCollection } from "@/lib/useAdminCollection";
import { usePortalState } from "@/lib/usePortalState";
import type { Homework, HomeworkDraft } from "@/lib/homeworkData";
import { HomeworkCard } from "../HomeworkCard";
import { AdminShell } from "../AdminShell";
import { AdminHomeworkSubmissions } from "./AdminHomeworkSubmissions";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import own from "./AdminHomeworkPage.module.css";

// Sections are edited as a heading + one task per line, and turned back
// into the structured shape for the preview and for sending.
type EditableSection = { heading: string; tasksText: string };

type SentHomework = Homework & { submittedCount: number; recipientCount: number };

function toEditable(draft: HomeworkDraft): EditableSection[] {
  return draft.sections.map((s) => ({ heading: s.heading, tasksText: s.tasks.join("\n") }));
}

function toDraft(title: string, intro: string, sections: EditableSection[]): HomeworkDraft {
  return {
    title: title.trim(),
    intro: intro.trim(),
    sections: sections
      .map((s) => ({ heading: s.heading.trim(), tasks: s.tasksText.split("\n").map((t) => t.trim()).filter(Boolean) }))
      .filter((s) => s.tasks.length > 0),
  };
}

// Admin → Homework: paste rough homework text, let the AI turn it into a
// proper homework sheet, adjust it, pick batches, send. Every student in
// those batches sees it right away under Student hub → Homework.
export function AdminHomeworkPage() {
  const { loaded: batchesLoaded, batches } = usePortalState();
  const { items: sent, loaded: sentLoaded, remove, refresh } = useAdminCollection<SentHomework>("/api/homework");
  const [openSubmissions, setOpenSubmissions] = useState<string | null>(null);

  const [sourceText, setSourceText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [hasDraft, setHasDraft] = useState(false);
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [sections, setSections] = useState<EditableSection[]>([]);

  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  const draft = toDraft(title, intro, sections);
  const batchName = (id: string) => {
    const b = batches.find((x) => x.id === id);
    return b ? `${b.course} · ${b.name}` : "Removed batch";
  };

  async function generate() {
    setGenerating(true);
    setGenError(null);
    setSentNotice(null);
    try {
      const res = await fetch("/api/homework/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Couldn't make the homework.");
      const { homework } = (await res.json()) as { homework: HomeworkDraft };
      setTitle(homework.title);
      setIntro(homework.intro);
      setSections(toEditable(homework));
      setHasDraft(true);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Couldn't make the homework.");
    } finally {
      setGenerating(false);
    }
  }

  function startBlank() {
    setTitle("");
    setIntro("");
    setSections([{ heading: "Exercise 1", tasksText: "" }]);
    setHasDraft(true);
    setSentNotice(null);
  }

  function updateSection(i: number, patch: Partial<EditableSection>) {
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function toggleBatch(id: string) {
    setBatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function send() {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homework: draft, batchIds, dueDate: dueDate || null, sourceText }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to send.");
      setSentNotice(`Sent to ${batchIds.length} ${batchIds.length === 1 ? "batch" : "batches"}.`);
      setSourceText("");
      setHasDraft(false);
      setTitle("");
      setIntro("");
      setSections([]);
      setBatchIds([]);
      setDueDate("");
      refresh();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  const canSend = draft.title !== "" && draft.sections.length > 0 && batchIds.length > 0 && !sending;

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Homework.</h1>
        <p>Tell the AI what homework you want — or paste your own in any rough form — and it makes a clean homework sheet. Check it, pick the batches, and send. Students see it straight away under Homework in their hub.</p>
      </div>

      <div className={own.layout}>
        <div className={own.editor}>
          <div className={styles.form}>
            <h2>1. Your homework text</h2>
            <label className={styles.fullWidth}>
              <span>Describe the homework you want (type, topic, level, how many questions) — or paste your own exercises</span>
              <textarea
                className={own.source}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={"e.g. 10 fill-in-the-blank sentences on the passé composé for A2, then 3 sentences to translate into French\n\nor paste your own:\nconjugate in passé composé: manger, aller, finir, prendre (je, tu, il, nous)\ntranslate: I went to the market yesterday / We ate at a restaurant\nwrite 5 lines about your weekend using passé composé\ndue monday"}
              />
            </label>
            <div className={own.buttons}>
              <button type="button" className={styles.save} onClick={generate} disabled={generating || !sourceText.trim()}>
                {generating ? "Making homework…" : hasDraft ? "Remake with AI" : "Make homework with AI"}
              </button>
              {!hasDraft && (
                <button type="button" className={styles.linkToggle} onClick={startBlank}>
                  Or write it without AI
                </button>
              )}
            </div>
            {genError && <p className={styles.uploadError}>{genError}</p>}
            {sentNotice && <p className={own.notice}>{sentNotice}</p>}
          </div>

          {hasDraft && (
            <div className={styles.form}>
              <h2>2. Check &amp; edit</h2>
              <label className={styles.fullWidth}>
                <span>Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className={styles.fullWidth}>
                <span>Intro (optional)</span>
                <textarea value={intro} onChange={(e) => setIntro(e.target.value)} />
              </label>

              {sections.map((s, i) => (
                <div key={i} className={own.sectionEdit}>
                  <div className={own.sectionEditHead}>
                    <input value={s.heading} placeholder="Section heading" onChange={(e) => updateSection(i, { heading: e.target.value })} />
                    <button type="button" className={styles.remove} onClick={() => setSections((prev) => prev.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={s.tasksText}
                    placeholder="One task per line"
                    onChange={(e) => updateSection(i, { tasksText: e.target.value })}
                  />
                  <small>One task per line — each line becomes a numbered item.</small>
                </div>
              ))}
              <button
                type="button"
                className={styles.linkToggle}
                onClick={() => setSections((prev) => [...prev, { heading: `Exercise ${prev.length + 1}`, tasksText: "" }])}
              >
                + Add section
              </button>
            </div>
          )}

          {hasDraft && (
            <div className={styles.form}>
              <h2>3. Send to batches</h2>
              {!batchesLoaded ? (
                <p className={styles.tabHint}>Loading batches…</p>
              ) : batches.length === 0 ? (
                <p className={styles.tabHint}>No batches yet — create one in Admin → Batches.</p>
              ) : (
                <>
                  <div className={own.batchList}>
                    {batches.map((b) => (
                      <label key={b.id} className={batchIds.includes(b.id) ? own.batchOn : own.batch}>
                        <input type="checkbox" checked={batchIds.includes(b.id)} onChange={() => toggleBatch(b.id)} />
                        <span>
                          <strong>{b.name}</strong>
                          <small>{b.course}{b.level ? ` · ${b.level}` : ""}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={own.selectAll}
                    onClick={() => setBatchIds(batchIds.length === batches.length ? [] : batches.map((b) => b.id))}
                  >
                    {batchIds.length === batches.length ? "Clear all" : "Select all batches"}
                  </button>
                </>
              )}
              <label className={styles.fullWidth}>
                <span>Due date (optional)</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
              <button type="button" className={styles.save} onClick={send} disabled={!canSend}>
                {sending ? "Sending…" : batchIds.length > 0 ? `Send to ${batchIds.length} ${batchIds.length === 1 ? "batch" : "batches"}` : "Send to batches"}
              </button>
              {sendError && <p className={styles.uploadError}>{sendError}</p>}
            </div>
          )}
        </div>

        {hasDraft && (
          <aside className={own.preview}>
            <span className={styles.sectionLabel}>PREVIEW — WHAT STUDENTS SEE</span>
            <HomeworkCard homework={draft} dueDate={dueDate || null} batches={batchIds.map(batchName)} />
          </aside>
        )}
      </div>

      <div className={own.sent}>
        <h2 className={own.sentTitle}>Sent homework</h2>
        {!sentLoaded ? (
          <p className={styles.tabHint}>Loading…</p>
        ) : sent.length === 0 ? (
          <div className={leadStyles.empty}>Nothing sent yet.</div>
        ) : (
          <>
            {openSubmissions && sent.some((hw) => hw.id === openSubmissions) && (
              <AdminHomeworkSubmissions homeworkId={openSubmissions} onClose={() => setOpenSubmissions(null)} />
            )}
            <div className={own.sentList}>
              {sent.map((hw) => (
                <HomeworkCard
                  key={hw.id}
                  homework={hw}
                  dueDate={hw.dueDate}
                  sentAt={hw.createdAt}
                  batches={hw.batchIds.map(batchName)}
                  actions={
                    <>
                      <button
                        type="button"
                        className={own.subsButton}
                        onClick={() => setOpenSubmissions(hw.id)}
                      >
                        Submissions {hw.submittedCount}/{hw.recipientCount}
                      </button>
                      <button
                        type="button"
                        className={styles.remove}
                        onClick={() => {
                          if (window.confirm(`Delete "${hw.title}"? Students will no longer see it, and their submitted answers will be deleted too.`)) {
                            if (openSubmissions === hw.id) setOpenSubmissions(null);
                            remove(hw.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
