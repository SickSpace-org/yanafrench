"use client";

import { useEffect, useMemo, useState } from "react";
import type { LibraryWord, TranslationResult } from "@/lib/aiHubData";
import { aiFetch, errorMessage, postJson, speakFrench } from "./aiHubClient";
import styles from "./AiHubApp.module.css";

// AI Translate & Library: translate French <-> English with notes and
// examples, save the useful words, and search them later.
export function TranslateLibrary() {
  const [tab, setTab] = useState<"translate" | "library">("translate");
  const [text, setText] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<LibraryWord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // The front page links here with ?tab=library.
    if (new URLSearchParams(window.location.search).get("tab") === "library") setTab("library");
    aiFetch<LibraryWord[]>("/api/ai-hub/library")
      .then(setWords)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const saved = useMemo(() => new Set(words.map((w) => w.term.toLowerCase())), [words]);

  async function translate() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await postJson<TranslationResult>("/api/ai-hub/translate", { text }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function save(term: string, meaning: string, note = "") {
    try {
      const word = await postJson<LibraryWord>("/api/ai-hub/library", { term, meaning, note });
      setWords((prev) => [word, ...prev.filter((w) => w.id !== word.id)]);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(id: string) {
    setWords((prev) => prev.filter((w) => w.id !== id));
    try {
      await aiFetch(`/api/ai-hub/library?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const q = query.trim().toLowerCase();
  const shown = q ? words.filter((w) => w.term.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)) : words;
  const frenchOut = result?.from === "English" ? result.translation : null;

  return (
    <div className={styles.narrow}>
      <div className={styles.head}>
        <small>TRANSLATE & LIBRARY</small>
        <h1>
          Understand it.
          <br />
          <em>Keep it.</em>
        </h1>
        <p>Translate between French and English with grammar notes and examples, then save the words you want to remember.</p>
      </div>

      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === "translate"} className={`${styles.tab} ${tab === "translate" ? styles.tabActive : ""}`} onClick={() => setTab("translate")}>
          Translate
        </button>
        <button type="button" role="tab" aria-selected={tab === "library"} className={`${styles.tab} ${tab === "library" ? styles.tabActive : ""}`} onClick={() => setTab("library")}>
          My library ({words.length})
        </button>
      </div>

      {error && <p className={styles.error} style={{ marginBottom: "1rem" }}>{error}</p>}

      {tab === "translate" && (
        <>
          <section className={styles.card}>
            <label className={styles.field}>
              French or English
              <textarea className={styles.textarea} value={text} maxLength={800} onChange={(e) => setText(e.target.value)} placeholder="Type a word, a phrase or a whole sentence…" />
            </label>
            <div className={styles.row} style={{ marginTop: ".8rem" }}>
              <button type="button" className={styles.btn} onClick={translate} disabled={busy || !text.trim()}>
                {busy ? "Translating…" : "Translate"}
              </button>
              <span className={styles.muted}>{text.length}/800</span>
            </div>
          </section>

          {result && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{result.from === "English" ? "English → French" : result.from === "French" ? "French → English" : "Translation"}</h2>
              <p className={styles.translation}>{result.translation}</p>
              <div className={styles.row} style={{ marginBottom: "1rem" }}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => speakFrench(frenchOut ?? text)}>
                  ▶ Hear the French
                </button>
              </div>
              {result.notes && <p className={styles.tip}>{result.notes}</p>}
              {result.examples.length > 0 && (
                <>
                  <h3 className={styles.cardTitle}>Examples</h3>
                  {result.examples.map((ex, i) => (
                    <p key={i} className={styles.example}>
                      {ex.fr}
                      <em>{ex.en}</em>
                    </p>
                  ))}
                </>
              )}
              {result.keyWords.length > 0 && (
                <>
                  <h3 className={styles.cardTitle} style={{ marginTop: "1rem" }}>Save to your library</h3>
                  <div className={styles.chips}>
                    {result.keyWords.map((k, i) => (
                      <span key={i} className={styles.chip}>
                        <span>
                          <strong>{k.term}</strong> · {k.meaning}
                        </span>
                        <button type="button" disabled={saved.has(k.term.toLowerCase())} onClick={() => save(k.term, k.meaning)}>
                          {saved.has(k.term.toLowerCase()) ? "Saved" : "Save"}
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}

      {tab === "library" && (
        <section className={styles.card}>
          <input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your words…" aria-label="Search your library" />
          {!loaded ? (
            <p className={styles.empty}>Loading…</p>
          ) : words.length === 0 ? (
            <p className={styles.empty}>Nothing saved yet. Translate something and save the words you want to keep.</p>
          ) : shown.length === 0 ? (
            <p className={styles.empty}>No words match &ldquo;{query}&rdquo;.</p>
          ) : (
            <div style={{ marginTop: ".6rem" }}>
              {shown.map((w) => (
                <div key={w.id} className={styles.word}>
                  <div>
                    <strong>{w.term}</strong>
                    <p>{w.meaning}</p>
                    {w.note && <p>{w.note}</p>}
                  </div>
                  <div className={styles.row} style={{ flexShrink: 0 }}>
                    <button type="button" className={styles.wordRemove} onClick={() => speakFrench(w.term)} aria-label={`Hear ${w.term}`}>
                      ▶
                    </button>
                    <button type="button" className={styles.wordRemove} onClick={() => remove(w.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
