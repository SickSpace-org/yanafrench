"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import styles from "../login/login.module.css";

const MIN_LENGTH = 8;

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"checking" | "ready" | "no-session" | "saving" | "done">(
    "checking"
  );
  const [error, setError] = useState<string | null>(null);

  // The recovery/invite link must have established a session (via
  // /auth/confirm) before this page can set a new password.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "no-session");
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setStatus("saving");
    const supabase = createBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }

    setStatus("done");
    // Full navigation so the server re-reads the session and routes by role.
    window.location.assign("/auth/home");
  }

  if (status === "checking") {
    return <p className={styles.notice}>Checking your link…</p>;
  }

  if (status === "no-session") {
    return (
      <div className={styles.form}>
        <p className={styles.error}>
          This page needs a valid reset link. Request a new one from “Forgot your
          password?”.
        </p>
        <a href="/forgot-password" className={styles.link}>
          Request a new link
        </a>
      </div>
    );
  }

  if (status === "done") {
    return <p className={styles.notice}>Password updated. Redirecting…</p>;
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <label className={styles.field}>
        <span>New password</span>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Confirm new password</span>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>

      <button type="submit" className={styles.submit} disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
