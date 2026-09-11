"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";
import styles from "./login.module.css";

const initialState: SignInState = { error: null };

export function LoginForm({ next, notice }: { next: string; notice: string | null }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form className={styles.form} action={formAction}>
      <input type="hidden" name="next" value={next} />

      {notice && <p className={styles.notice}>{notice}</p>}
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <label className={styles.field}>
        <span>Email</span>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
        />
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <Link href="/forgot-password" className={styles.link}>
        Forgot your password?
      </Link>
    </form>
  );
}
