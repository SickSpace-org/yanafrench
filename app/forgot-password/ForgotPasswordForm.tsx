"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "../login/login.module.css";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Don't reveal whether the address has an account — always "sent".
      setStatus("sent");
    } catch {
      setStatus("error");
    }
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
          Something went wrong. Try again in a moment.
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
