"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatIndiaDate } from "@/lib/emiData";
import { formatFileSize, materialDownloadUrl, type BatchMaterial, type BatchRecording } from "@/lib/batchContentData";
import { useTeacherMe } from "@/lib/useTeacherMe";
import { TeacherBatchPicker } from "./TeacherBatchPicker";
import styles from "./TeacherPortal.module.css";
import admin from "./admin/AdminLessonsManager.module.css";
import leadStyles from "./admin/AdminLeadsPanel.module.css";

// Teacher -> Class content: recording links and files for one of the
// teacher's own batches. Students actively in that batch see them in their
// Lessons page with the teacher's name. Every change is logged for the
// admin (Admin -> Teachers -> Activity).

type Content = { recordings: BatchRecording[]; materials: BatchMaterial[]; uploadsEnabled: boolean };

async function errorText(res: Response, fallback: string) {
  return (await res.text().catch(() => "")) || fallback;
}

function Recordings({ batchId, recordings, reload, notify }: { batchId: string; recordings: BatchRecording[]; reload: () => void; notify: (ok: boolean, text: string) => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [classDate, setClassDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/teacher/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, title, url, classDate: classDate || null }),
      });
      if (!res.ok) return notify(false, await errorText(res, "Couldn't save the recording."));
      setTitle("");
      setUrl("");
      setClassDate("");
      notify(true, "Recording added — students in this batch can see it now.");
    } finally {
      setBusy(false);
      reload();
    }
  }

  async function save(id: string, patch: Record<string, string | null>) {
    const res = await fetch(`/api/teacher/recordings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) notify(false, await errorText(res, "Couldn't save the recording."));
    else {
      setEditing(null);
      notify(true, "Recording updated.");
    }
    reload();
  }

  async function remove(r: BatchRecording) {
    if (!window.confirm(`Delete "${r.title}"? Students will no longer see it.`)) return;
    const res = await fetch(`/api/teacher/recordings/${encodeURIComponent(r.id)}`, { method: "DELETE" });
    notify(res.ok, res.ok ? "Recording deleted." : await errorText(res, "Couldn't delete the recording."));
    reload();
  }

  return (
    <section className={styles.batch}>
      <h2 className={styles.batchTitle}>Class recordings</h2>
      <p className={styles.meta}>Paste a link to the recording (Zoom cloud, YouTube unlisted, Google Drive…). Recordings aren&rsquo;t uploaded here.</p>
      <form className={admin.form} onSubmit={add}>
        <div className={admin.fieldGrid}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </label>
          <label>
            Link
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://…" />
          </label>
          <label>
            Class date (optional)
            <input type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)} />
          </label>
        </div>
        <button type="submit" className={admin.save} disabled={busy}>{busy ? "Saving…" : "Add recording"}</button>
      </form>

      {recordings.length === 0 ? (
        <p className={styles.meta}>No recordings for this batch yet.</p>
      ) : (
        <ul className={styles.itemList}>
          {recordings.map((r) =>
            editing === r.id ? (
              <RecordingEditor key={r.id} recording={r} onCancel={() => setEditing(null)} onSave={(patch) => save(r.id, patch)} />
            ) : (
              <li key={r.id} className={styles.item}>
                <div>
                  <a href={r.url} target="_blank" rel="noreferrer noopener">{r.title}</a>
                  <div className={styles.meta}>
                    {[r.classDate ? formatIndiaDate(r.classDate) : null, `added by ${r.authorName}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className={styles.itemActions}>
                  <button type="button" className={leadStyles.action} onClick={() => setEditing(r.id)}>Edit</button>
                  <button type="button" className={leadStyles.remove} onClick={() => remove(r)}>Delete</button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}

function RecordingEditor({ recording, onCancel, onSave }: { recording: BatchRecording; onCancel: () => void; onSave: (patch: Record<string, string | null>) => void }) {
  const [title, setTitle] = useState(recording.title);
  const [url, setUrl] = useState(recording.url);
  const [classDate, setClassDate] = useState(recording.classDate ?? "");
  return (
    <li className={styles.item}>
      <form
        className={admin.inlineForm}
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ title, url, classDate: classDate || null });
        }}
      >
        <input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        <input aria-label="Link" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
        <input aria-label="Class date" type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)} />
        <button type="submit" className={leadStyles.action}>Save</button>
        <button type="button" className={leadStyles.remove} onClick={onCancel}>Cancel</button>
      </form>
    </li>
  );
}

function Materials({
  batchId,
  materials,
  uploadsEnabled,
  reload,
  notify,
}: {
  batchId: string;
  materials: BatchMaterial[];
  uploadsEnabled: boolean;
  reload: () => void;
  notify: (ok: boolean, text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return notify(false, "Choose a file first.");
    setBusy("Preparing upload…");
    try {
      const prep = await fetch("/api/teacher/materials/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, fileName: file.name, contentType: file.type, size: file.size }),
      });
      if (!prep.ok) return notify(false, await errorText(prep, "Couldn't prepare the upload."));
      const { key, uploadUrl } = (await prep.json()) as { key: string; uploadUrl: string };

      setBusy("Uploading…");
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) return notify(false, "The upload failed — please try again.");

      setBusy("Saving…");
      const saved = await fetch("/api/teacher/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, key, title: title.trim() || file.name, fileName: file.name }),
      });
      if (!saved.ok) return notify(false, await errorText(saved, "Couldn't save the file."));
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      notify(true, "File shared — students in this batch can download it now.");
    } catch {
      notify(false, "The upload failed — please try again.");
    } finally {
      setBusy(null);
      reload();
    }
  }

  async function rename(m: BatchMaterial) {
    const next = window.prompt("New title", m.title)?.trim();
    if (!next || next === m.title) return;
    const res = await fetch(`/api/teacher/materials/${encodeURIComponent(m.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next }),
    });
    notify(res.ok, res.ok ? "File renamed." : await errorText(res, "Couldn't rename the file."));
    reload();
  }

  async function remove(m: BatchMaterial) {
    if (!window.confirm(`Delete "${m.title}"? Students will no longer be able to download it.`)) return;
    const res = await fetch(`/api/teacher/materials/${encodeURIComponent(m.id)}`, { method: "DELETE" });
    notify(res.ok, res.ok ? "File deleted." : await errorText(res, "Couldn't delete the file."));
    reload();
  }

  return (
    <section className={styles.batch}>
      <h2 className={styles.batchTitle}>Files</h2>
      {uploadsEnabled ? (
        <form className={admin.form} onSubmit={upload}>
          <p className={styles.meta}>PDF, Word, PowerPoint, Excel, text, images or audio, up to 50 MB. Only students in this batch can download them.</p>
          <div className={admin.fieldGrid}>
            <label>
              File
              <input ref={fileRef} type="file" required />
            </label>
            <label>
              Title (optional)
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </label>
          </div>
          <button type="submit" className={admin.save} disabled={busy !== null}>{busy ?? "Upload file"}</button>
        </form>
      ) : (
        <p className={styles.meta}>File sharing isn&rsquo;t switched on yet — Yana needs to set up the private files storage first.</p>
      )}

      {materials.length === 0 ? (
        <p className={styles.meta}>No files for this batch yet.</p>
      ) : (
        <ul className={styles.itemList}>
          {materials.map((m) => (
            <li key={m.id} className={styles.item}>
              <div>
                <a href={materialDownloadUrl(m.id)}>{m.title}</a>
                <div className={styles.meta}>
                  {m.fileName} · {formatFileSize(m.sizeBytes)} · shared by {m.authorName}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button type="button" className={leadStyles.action} onClick={() => rename(m)}>Rename</button>
                <button type="button" className={leadStyles.remove} onClick={() => remove(m)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TeacherContentPage() {
  const { me, failed } = useTeacherMe();
  const [batchId, setBatchId] = useState("");
  const [content, setContent] = useState<Content | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await fetch(`/api/teacher/content?batchId=${encodeURIComponent(batchId)}`, { cache: "no-store" });
      if (res.ok) setContent(await res.json());
    } catch {
      // keep what's shown
    }
  }, [batchId]);

  useEffect(() => {
    setContent(null);
    setNotice(null);
    load();
  }, [load]);

  if (failed) return <div className={styles.empty}>Couldn&rsquo;t load your batches. Refresh the page to try again.</div>;
  if (!me) return <p className={styles.meta}>Loading…</p>;
  const notify = (ok: boolean, text: string) => setNotice({ ok, text });

  return (
    <>
      <div className={styles.head}>
        <small>TEACHER</small>
        <h1>Class content.</h1>
        <p>Recordings and files for one batch at a time. Students in that batch see them under Lessons, with your name on them.</p>
      </div>

      <div className={styles.stack}>
        <TeacherBatchPicker batches={me.batches} value={batchId} onChange={setBatchId} />
        {notice && <p className={notice.ok ? leadStyles.banner : leadStyles.confirmError}>{notice.text}</p>}
        {batchId &&
          (content === null ? (
            <p className={styles.meta}>Loading…</p>
          ) : (
            <>
              <Recordings batchId={batchId} recordings={content.recordings} reload={load} notify={notify} />
              <Materials batchId={batchId} materials={content.materials} uploadsEnabled={content.uploadsEnabled} reload={load} notify={notify} />
            </>
          ))}
      </div>
    </>
  );
}
