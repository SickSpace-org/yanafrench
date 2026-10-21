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

type Mode = "read" | "monologue";

const MAX_RECORD_MS = 90_000;
const MAX_MONOLOGUE_MS = 120_000;

type Topic = { fr: string; en: string; points: string[] };

// Challenging prompts for the monologue mode; the points are things to cover.
const TOPICS: Topic[] = [
  { fr: "Faut-il interdire les téléphones portables à l'école ? Défendez votre opinion.", en: "Should phones be banned in schools? Defend your opinion.", points: ["votre position", "deux arguments", "un contre-argument", "votre conclusion"] },
  { fr: "Le télétravail est-il l'avenir du travail ?", en: "Is remote work the future of work?", points: ["les avantages", "les inconvénients", "l'impact sur la vie privée", "votre avis"] },
  { fr: "Si vous pouviez changer une loi dans votre pays, laquelle choisiriez-vous et pourquoi ?", en: "If you could change one law in your country, which and why?", points: ["la situation actuelle", "le changement", "les conséquences possibles"] },
  { fr: "L'intelligence artificielle : une chance ou une menace pour l'emploi ?", en: "Artificial intelligence: an opportunity or a threat to jobs?", points: ["les métiers concernés", "les opportunités", "les risques", "ce qu'il faudrait faire"] },
  { fr: "Peut-on être heureux sans argent ?", en: "Can you be happy without money?", points: ["ce qui rend heureux", "le rôle de l'argent", "un exemple personnel"] },
  { fr: "Vivre à l'étranger : une chance ou un sacrifice ?", en: "Living abroad: an opportunity or a sacrifice?", points: ["ce qu'on gagne", "ce qu'on perd", "l'intégration", "votre expérience ou votre rêve"] },
  { fr: "Que feriez-vous si vous étiez maire de votre ville pendant un an ?", en: "What would you do as mayor of your town for a year?", points: ["les problèmes à résoudre", "vos trois mesures", "le budget", "les critiques possibles"] },
  { fr: "Le changement climatique : que peut faire chacun de nous, et que doivent faire les gouvernements ?", en: "Climate change: what can individuals do, and what must governments do?", points: ["les gestes individuels", "le rôle de l'État", "les obstacles", "votre espoir ou votre crainte"] },
  { fr: "Racontez une décision difficile que vous avez prise et ce que vous feriez autrement aujourd'hui.", en: "Tell about a hard decision and what you would do differently today.", points: ["le contexte", "les options", "le résultat", "ce que vous avez appris"] },
  { fr: "Les voyages forment-ils mieux la jeunesse que l'école ? Comparez les deux.", en: "Does travel teach young people better than school? Compare the two.", points: ["ce qu'on apprend en voyageant", "ce qu'on apprend à l'école", "votre conclusion"] },
];

function randomTopic(exclude?: Topic | null): Topic {
  const pool = TOPICS.filter((t) => t !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

// AI Speaking: either read a French paragraph aloud, or speak freely on a
// random topic; record yourself and receive scores plus fixes from the AI.
export function Pronunciation() {
  const [mode, setMode] = useState<Mode>("read");
  const [mono, setMono] = useState<Topic | null>(null);
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
      stopTimerRef.current = setTimeout(stopRecording, mode === "monologue" ? MAX_MONOLOGUE_MS : MAX_RECORD_MS);
    } catch {
      setError("Couldn't reach your microphone. Check your browser's permission and try again.");
    }
  }

  function stopRecording() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function chooseMode(next: Mode) {
    if (next === mode || rec === "recording" || rec === "submitting") return;
    setMode(next);
    setError(null);
    setResult(null);
    resetRecording();
    if (next === "monologue" && !mono) setMono(randomTopic());
  }

  function shuffleTopic() {
    setResult(null);
    setError(null);
    resetRecording();
    setMono(randomTopic(mono));
  }

  async function submit() {
    const target = mode === "monologue" ? mono?.fr : phrase?.phrase;
    if (!blobRef.current || !target) return;
    setRec("submitting");
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blobRef.current, "recording.webm");
      form.append("phrase", target);
      form.append("mode", mode);
      form.append("level", level);
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

  const recorder = (
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
  );


  return (
    <div className={styles.narrow}>
      <div className={styles.head}>
        <small>SPEAKING</small>
        <h1>
          Say it out loud.
          <br />
          <em>Hear what to fix.</em>
        </h1>
        <p>Read a paragraph at your level, or talk freely on a random topic. The AI listens to your actual sounds — not just your words.</p>
      </div>

      <div className={styles.row} style={{ marginBottom: "1rem" }}>
        <button type="button" className={`${styles.btn} ${mode === "read" ? "" : styles.btnGhost}`} onClick={() => chooseMode("read")}>
          Read &amp; speak
        </button>
        <button type="button" className={`${styles.btn} ${mode === "monologue" ? "" : styles.btnGhost}`} onClick={() => chooseMode("monologue")}>
          Speak as monologue
        </button>
      </div>

      {mode === "monologue" ? (
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
            <button type="button" className={styles.btn} onClick={mono ? shuffleTopic : () => setMono(randomTopic())} disabled={rec === "recording" || rec === "submitting"}>
              {mono ? "🎲 Another topic" : "🎲 Give me a topic"}
            </button>
          </div>
          {mono && (
            <div style={{ marginTop: "1.4rem" }}>
              <p className={styles.phrase} style={{ lineHeight: 1.7 }}>
                {mono.fr} Parlez pendant une minute environ, sans vous arrêter : {mono.points.join(", ")}.
              </p>
              <p className={styles.phraseEn}>
                {mono.en} Speak for about a minute without stopping (up to 2 minutes).
              </p>
              {recorder}
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </section>
      ) : (
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
            {loadingPhrase ? "Thinking…" : phrase ? "New paragraph" : "Give me a paragraph"}
          </button>
        </div>

        {phrase && (
          <div style={{ marginTop: "1.4rem" }}>
            <p className={styles.phrase} style={{ fontSize: "clamp(1.1rem, 3vw, 1.45rem)", lineHeight: 1.7 }}>{phrase.phrase}</p>
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

            {recorder}
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </section>
      )}

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
              <span>{h.phrase.length > 90 ? `${h.phrase.slice(0, 90)}…` : h.phrase}</span>
              <span className={styles.historyScore}>{h.evaluation.overall.toFixed(1)}/10</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
