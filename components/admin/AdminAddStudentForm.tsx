"use client";

import { useState, type FormEvent } from "react";
import type { Batch } from "@/lib/batchData";
import styles from "./AdminLessonsManager.module.css";

// Admin → Students' "Add student" form — creates a student by hand (e.g. a
// cash / bank-transfer payer), optionally into a batch, optionally emailing
// the account setup link. See app/api/students POST.
export function AdminAddStudentForm({ batches, onAdded }: { batches: Batch[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [batchId, setBatchId] = useState("");
  const [sendSetupLink, setSendSetupLink] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, batchId: batchId || undefined, sendSetupLink }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || "Couldn't add the student.");
        return;
      }
      const data = await res.json().catch(() => null);
      const problems: string[] = [];
      if (batchId && !data?.batchAdded) problems.push("couldn't add them to the batch — use \"+ Add to batch…\" on their row");
      if (sendSetupLink && !data?.emailSent) problems.push("the setup link wasn't delivered — use \"Send setup link\" on their row");
      setNotice(problems.length ? `${name.trim()} was added, but ${problems.join(" and ")}.` : `${name.trim()} was added.`);
      setName("");
      setEmail("");
      setPhone("");
      setBatchId("");
      setOpen(false);
      onAdded();
    } catch {
      setError("Couldn't add the student.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {notice && <p className={styles.tabHint} style={{ fontWeight: 700 }}>{notice}</p>}
      {!open ? (
        <button type="button" className={styles.linkToggle} onClick={() => { setOpen(true); setNotice(null); }}>
          + Add student
        </button>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <h2>Add a student</h2>
          <div className={styles.fieldGrid}>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Phone (optional)
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className={styles.fullWidth}>
              Batch (optional)
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">No batch yet</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.course} · {b.name}{b.published ? "" : " (draft)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: ".5rem", fontSize: ".75rem" }}>
            <input type="checkbox" checked={sendSetupLink} onChange={(e) => setSendSetupLink(e.target.checked)} style={{ width: "auto" }} />
            Email them a link to set up their login
          </label>
          {error && <p className={styles.tabHint} style={{ color: "#B63A3A", fontWeight: 700 }}>{error}</p>}
          <div style={{ display: "flex", gap: ".8rem", alignItems: "center" }}>
            <button type="submit" className={styles.save} disabled={saving}>{saving ? "Adding…" : "Add student"}</button>
            <button type="button" className={styles.rowLink} style={{ background: "none", borderTop: 0, borderLeft: 0, borderRight: 0 }} onClick={() => { setOpen(false); setError(null); }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
}
