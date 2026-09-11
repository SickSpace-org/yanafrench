"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import styles from "../login/login.module.css";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });

    // Don't reveal whether the address has an account.
    setStatus(error && error.status === 429 ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <div className={styles.form}>
        <p className={styles.notice}>
          If an account exists for <strong>{email.trim()}</strong>, a password-reset
          link is on its way. The link opens a page where you set a new password.
        </p>
        <Link href="/login" className={styles.link}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {status === "error" && (
        <p className={styles.error} role="alert">
          Too many attempts. Wait a minute and try again.
        </p>
      )}

      <label className={styles.field}>
        <span>Email</span>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <button type="submit" className={styles.submit} disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send reset link"}
      </button>

      <Link href="/login" className={styles.link}>
        Back to sign in
      </Link>
    </form>
  );
}
