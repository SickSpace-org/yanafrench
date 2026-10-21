"use client";

import { useEffect, useRef, useState } from "react";
import {
  AI_HUB_LEVELS,
  type AiHubLevel,
  type PronunciationAttempt,
  type PronunciationPhrase,
} from "@/lib/aiHubData";
import { aiFetch, errorMessage, postJson, speakFrench } from "./aiHubClient";
import styles from "./AiHubApp.module.css";

type RecState = "idle" | "recording" | "recorded" | "submitting";

const MAX_RECORD_MS = 30_000;

// AI Pronunciation: get a French sentence, hear it, record yourself, and
// receive scores plus word-level fixes from the AI.
export function Pronunciation() {
  const [level, setLevel] = useState<AiHubLevel>("A2");
  const [topic, setTopic] = useState("");
  const [phrase, setPhrase] = useState<PronunciationPhrase | null>(null);
  const [loadingPhrase, setLoadingPhrase] = useState(false);
  const [rec, setRec] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PronunciationAttempt | null>(null);
  const [history, setHistory] = useState<PronunciationAttempt[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("aihub-level");
      if (saved && (AI_HUB_LEVELS as readonly string[]).includes(saved)) setLevel(saved as AiHubLevel);
    } catch {
      // storage unavailable — keep the default level
    }
    aiFetch<PronunciationAttempt[]>("/api/ai-hub/pronunciation/history").then(setHistory).catch(() => {});
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function chooseLevel(next: AiHubLevel) {
    setLevel(next);
    try {
      localStorage.setItem("aihub-level", next);
    } catch {
      // not critical
    }
  }

  function resetRecording() {
    blobRef.current = null;
    setAudioUrl(null);
    setRec("idle");
  }

  async function newPhrase() {
    setLoadingPhrase(true);
    setError(null);
    setResult(null);
    resetRecording();
    try {
      setPhrase(await postJson<PronunciationPhrase>("/api/ai-hub/pronunciation/phrase", { level, topic }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingPhrase(false);
    }
  }

  async function startRecording() {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        setRec("recorded");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRec("recording");
      stopTimerRef.current = setTimeout(stopRecording, MAX_RECORD_MS);
    } catch {
      setError("Couldn't reach your microphone. Check your browser's permission and try again.");
    }
  }

  function stopRecording() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function submit() {
    if (!blobRef.current || !phrase) return;
    setRec("submitting");
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blobRef.current, "recording.webm");
      form.append("phrase", phrase.phrase);
      const attempt = await aiFetch<PronunciationAttempt>("/api/ai-hub/pronunciation/evaluate", { method: "POST", body: form });
      setResult(attempt);
      setHistory((h) => [attempt, ...h].slice(0, 20));
      setRec("recorded");
    } catch (err) {
      setError(errorMessage(err));
      setRec("recorded");
    }
  }

  const ev = result?.evaluation;

  return (
    <div className={styles.narrow}>
      <div className={styles.head}>
        <small>PRONUNCIATION</small>
        <h1>
          Say it out loud.
          <br />
          <em>Hear what to fix.</em>
        </h1>
        <p>Get a sentence at your level, listen, record yourself, and the AI listens to your actual sounds — not just your words.</p>
      </div>

      <section className={styles.card}>
        <div className={styles.row} style={{ alignItems: "flex-end" }}>
          <label className={styles.field} style={{ width: 110 }}>
            Level
            <select className={styles.select} value={level} onChange={(e) => chooseLevel(e.target.value as AiHubLevel)}>
              {AI_HUB_LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className={styles.field} style={{ flex: "1 1 200px" }}>
            Topic (optional)
            <input className={styles.input} value={topic} maxLength={80} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. food, travel, work" />
          </label>
          <button type="button" className={styles.btn} onClick={newPhrase} disabled={loadingPhrase}>
            {loadingPhrase ? "Thinking…" : phrase ? "New sentence" : "Give me a sentence"}
          </button>
        </div>

        {phrase && (
          <div style={{ marginTop: "1.4rem" }}>
            <p className={styles.phrase}>{phrase.phrase}</p>
            <p className={styles.phraseEn}>{phrase.translation}</p>
            {phrase.tip && <p className={styles.tip}>Watch out: {phrase.tip}</p>}
            <div className={styles.row}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => speakFrench(phrase.phrase)}>
                ▶ Listen
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => speakFrench(phrase.phrase, true)}>
                ▶ Listen slowly
              </button>
            </div>

            <div className={styles.rec}>
              {rec === "idle" && (
                <button type="button" className={`${styles.btn} ${styles.btnRed}`} onClick={startRecording}>
                  ● Record
                </button>
              )}
              {rec === "recording" && (
                <>
                  <span className={styles.recDot} aria-hidden="true" />
                  <button type="button" className={styles.btn} onClick={stopRecording}>
                    ■ Stop
                  </button>
                </>
              )}
              {(rec === "recorded" || rec === "submitting") && (
                <>
                  {audioUrl && <audio src={audioUrl} controls style={{ height: 36 }} />}
                  <button type="button" className={styles.btn} onClick={submit} disabled={rec === "submitting" || Boolean(result)}>
                    {rec === "submitting" ? "Listening…" : "Get feedback"}
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={resetRecording} disabled={rec === "submitting"}>
                    Re-record
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      {ev && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Your feedback</h2>
          <div className={styles.scores}>
            <div className={styles.score}><strong>{ev.overall.toFixed(1)}</strong><span>Overall</span></div>
            <div className={styles.score}><strong>{ev.accuracy.toFixed(1)}</strong><span>Accuracy</span></div>
            <div className={styles.score}><strong>{ev.rhythm.toFixed(1)}</strong><span>Rhythm</span></div>
          </div>
          <p className={styles.muted}>We heard: &ldquo;{ev.transcript}&rdquo;</p>
          {ev.problemWords.map((w, i) => (
            <div key={i} className={styles.problem}>
              <strong>{w.word}</strong> — {w.issue}
              <br />
              <span className={styles.muted}>Try: {w.howToSay}</span>
            </div>
          ))}
          <p className={styles.good}>{ev.wellDone}</p>
          <p className={styles.improve}>{ev.improve}</p>
        </section>
      )}

      {history.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Recent attempts</h2>
          {history.map((h) => (
            <div key={h.id} className={styles.historyItem}>
              <span>{h.phrase}</span>
              <span className={styles.historyScore}>{h.evaluation.overall.toFixed(1)}/10</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
