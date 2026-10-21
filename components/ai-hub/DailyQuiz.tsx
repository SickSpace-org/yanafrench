"use client";

import { useEffect, useState } from "react";
import { AI_HUB_LEVELS, type AiHubLevel, type AiQuizState } from "@/lib/aiHubData";
import { aiFetch, errorMessage, postJson } from "./aiHubClient";
import styles from "./AiHubApp.module.css";

type NeedsLevel = { needsLevel: true; streak: number };
type Loaded = AiQuizState | NeedsLevel;

const isNeedsLevel = (v: Loaded): v is NeedsLevel => "needsLevel" in v;

// AI Daily Quiz: one fresh quiz per day at the member's level, graded
// instantly, with a streak of consecutive days completed.
export function DailyQuiz() {
  const [data, setData] = useState<Loaded | null>(null);
  const [level, setLevel] = useState<AiHubLevel>("A2");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("aihub-level");
      if (saved && (AI_HUB_LEVELS as readonly string[]).includes(saved)) setLevel(saved as AiHubLevel);
    } catch {
      // storage unavailable — keep the default level
    }
    aiFetch<Loaded>("/api/ai-hub/quiz")
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem("aihub-level", level);
    } catch {
      // not critical
    }
    try {
      setData(await aiFetch<Loaded>(`/api/ai-hub/quiz?level=${level}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      setData(await postJson<AiQuizState>("/api/ai-hub/quiz", { answers }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const quiz = data && !isNeedsLevel(data) ? data : null;
  const streak = data?.streak ?? 0;
  const answered = quiz ? quiz.questions.filter((q) => (answers[q.id] ?? "").trim()).length : 0;

  return (
    <div className={styles.narrow}>
      <div className={styles.head}>
        <small>DAILY QUIZ</small>
        <h1>
          Eight questions.
          <br />
          <em>Every day.</em>
        </h1>
        <p>A new quiz is written for you each day. Finish it to keep your streak alive.</p>
      </div>

      {data && (
        <p style={{ margin: "0 0 1rem" }}>
          <span className={styles.streak}>🔥 {streak}-day streak</span>
        </p>
      )}
      {error && <p className={styles.error} style={{ marginBottom: "1rem" }}>{error}</p>}

      {!data && !error && <p className={styles.empty}>Loading…</p>}

      {data && isNeedsLevel(data) && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Today&rsquo;s quiz</h2>
          <div className={styles.row} style={{ alignItems: "flex-end" }}>
            <label className={styles.field} style={{ width: 120 }}>
              Your level
              <select className={styles.select} value={level} onChange={(e) => setLevel(e.target.value as AiHubLevel)}>
                {AI_HUB_LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <button type="button" className={styles.btn} onClick={start} disabled={busy}>
              {busy ? "Writing your quiz…" : "Start today's quiz"}
            </button>
          </div>
        </section>
      )}

      {quiz && !quiz.completed && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Level {quiz.level} · {quiz.date}</h2>
          {quiz.questions.map((q, i) => (
            <div key={q.id} className={styles.question}>
              <span className={styles.qNum}>QUESTION {i + 1} OF {quiz.questions.length}</span>
              <p className={styles.qPrompt}>{q.prompt}</p>
              {q.type === "mcq" ? (
                <div className={styles.choices}>
                  {q.choices.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`${styles.choice} ${answers[q.id] === c ? styles.choiceOn : ""}`}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: c }))}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  className={styles.input}
                  value={answers[q.id] ?? ""}
                  maxLength={200}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Type your answer"
                  aria-label={`Answer to question ${i + 1}`}
                />
              )}
            </div>
          ))}
          <div className={styles.row} style={{ marginTop: "1rem" }}>
            <button type="button" className={styles.btn} onClick={submit} disabled={busy || answered === 0}>
              {busy ? "Marking…" : "Submit answers"}
            </button>
            <span className={styles.muted}>{answered}/{quiz.questions.length} answered</span>
          </div>
        </section>
      )}

      {quiz?.completed && quiz.results && (
        <>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Today&rsquo;s result</h2>
            <p className={styles.bigScore}>
              {quiz.score}/{quiz.questions.length}
            </p>
            <p className={styles.muted} style={{ marginTop: ".6rem" }}>
              {quiz.score === quiz.questions.length
                ? "Perfect — tres bien !"
                : "Review the answers below, then come back tomorrow for a fresh quiz."}
            </p>
          </section>
          <section className={styles.card}>
            {quiz.questions.map((q, i) => {
              const r = quiz.results!.find((x) => x.id === q.id);
              if (!r) return null;
              return (
                <div key={q.id} className={styles.question}>
                  <span className={styles.qNum}>QUESTION {i + 1}</span>
                  <p className={styles.qPrompt}>{q.prompt}</p>
                  <div className={`${styles.choice} ${r.correct ? styles.right : styles.wrong}`} style={{ cursor: "default" }}>
                    {r.correct ? "✓ " : "✗ "}
                    {r.yourAnswer || "(no answer)"}
                  </div>
                  {!r.correct && (
                    <div className={`${styles.choice} ${styles.right}`} style={{ cursor: "default", marginTop: ".4rem" }}>
                      Correct answer: {r.correctAnswer}
                    </div>
                  )}
                  <p className={styles.explain}>{r.explanation}</p>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
