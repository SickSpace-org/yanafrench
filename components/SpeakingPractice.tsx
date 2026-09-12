"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { prompts, evaluateAttempt } from "@/lib/speakingData";
import { DashboardShell } from "./DashboardShell";
import styles from "./SpeakingPractice.module.css";

type RecorderState = "idle" | "requesting" | "recording" | "paused" | "recorded" | "submitting";

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SpeakingPractice() {
  const router = useRouter();
  const [prompt] = useState(prompts[0]);
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(40).fill(4));

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      stopTimer();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(elapsedBeforePauseRef.current + (Date.now() - startTimeRef.current));
    }, 200);
  }

  function drawLevels() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const bucket = Math.floor(data.length / 40);
    const next: number[] = [];
    for (let i = 0; i < 40; i++) {
      let sum = 0;
      for (let j = 0; j < bucket; j++) sum += data[i * bucket + j];
      next.push(4 + (sum / bucket / 255) * 46);
    }
    setLevels(next);
    rafRef.current = requestAnimationFrame(drawLevels);
  }

  async function startRecording() {
    setError(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
      recorderRef.current = recorder;
      recorder.start();

      elapsedBeforePauseRef.current = 0;
      setElapsedMs(0);
      startTimer();
      drawLevels();
      setState("recording");
    } catch {
      setError("Couldn't access your microphone. Check your browser's permission settings and try again.");
      setState("idle");
    }
  }

  function pauseRecording() {
    recorderRef.current?.pause();
    elapsedBeforePauseRef.current = elapsedMs;
    stopTimer();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setState("paused");
  }

  function resumeRecording() {
    recorderRef.current?.resume();
    startTimer();
    drawLevels();
    setState("recording");
  }

  function stopRecording() {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    stopTimer();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setLevels(Array(40).fill(4));
    setState("recorded");
  }

  function reRecord() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    audioBlobRef.current = null;
    elapsedBeforePauseRef.current = 0;
    setElapsedMs(0);
    setState("idle");
  }

  function togglePlayback() {
    const el = audioElRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.play();
    }
  }

  async function handleSubmit() {
    if (!audioBlobRef.current) return;
    setState("submitting");
    setError(null);
    try {
      const attempt = await evaluateAttempt(audioBlobRef.current, prompt.text, prompt.topic, formatDuration(elapsedMs));
      router.push(`/student-hub/speaking/results?attempt=${attempt.id}`);
    } catch (err) {
      setError(
        err instanceof Error && err.message === "RATE_LIMITED"
          ? "Getting a lot of evaluations right now — please try again in a minute."
          : "Couldn't evaluate that recording. Please try again."
      );
      setState("recorded");
    }
  }

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>SPEAKING · PRACTICE</small>
        <h1>Record your answer.<br /><em>Then improve it.</em></h1>
      </div>

      <div className={styles.promptCard}>
        <span>{prompt.topic.toUpperCase()}</span>
        <p>{prompt.text}</p>
      </div>

      <div className={styles.recorder}>
        <div className={styles.waveform} aria-hidden="true">
          {levels.map((h, i) => (
            <i key={i} style={{ height: `${h}px`, opacity: state === "recording" ? 1 : 0.35 }} />
          ))}
        </div>

        <div className={styles.duration}>{formatDuration(elapsedMs)}</div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.controls}>
          {state === "idle" && (
            <button type="button" className={styles.primaryButton} onClick={startRecording}>
              ● Start recording
            </button>
          )}

          {state === "requesting" && (
            <button type="button" className={styles.primaryButton} disabled>Requesting mic access…</button>
          )}

          {state === "recording" && (
            <>
              <button type="button" className={styles.secondaryButton} onClick={pauseRecording}>Pause</button>
              <button type="button" className={styles.stopButton} onClick={stopRecording}>Stop</button>
            </>
          )}

          {state === "paused" && (
            <>
              <button type="button" className={styles.secondaryButton} onClick={resumeRecording}>Resume</button>
              <button type="button" className={styles.stopButton} onClick={stopRecording}>Stop</button>
            </>
          )}

          {state === "recorded" && (
            <>
              <button type="button" className={styles.secondaryButton} onClick={togglePlayback}>{isPlaying ? "Pause" : "▶ Play"}</button>
              <button type="button" className={styles.secondaryButton} onClick={reRecord}>Re-record</button>
              <button type="button" className={styles.primaryButton} onClick={handleSubmit}>Submit</button>
            </>
          )}

          {state === "submitting" && (
            <button type="button" className={styles.primaryButton} disabled>Evaluating your answer…</button>
          )}
        </div>

        {audioUrl && (
          <audio
            ref={audioElRef}
            src={audioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            className={styles.hiddenAudio}
          />
        )}
      </div>

      <Link href="/student-hub/speaking/history" className={styles.historyLink}>View past attempts →</Link>
    </DashboardShell>
  );
}
