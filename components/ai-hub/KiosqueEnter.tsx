"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./AiHubLanding.module.css";

// The one screen between a member and Le Kiosque: type the email you signed
// up with. If Yana has confirmed your payment you go straight in.
export function KiosqueEnter() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-hub/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || "Something went wrong. Please try again.");
        return;
      }
      router.replace("/kiosque/app");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} style={{ marginBottom: "2rem" }}>
        <span className={styles.eyebrow}>LE KIOSQUE</span>
        <h1>
          Welcome back.
          <br />
          <em>What&rsquo;s your email?</em>
        </h1>
        <p>Type the email you signed up with. If your payment has been confirmed, Le Kiosque opens straight away — no password.</p>
      </section>

      <form className={styles.form} onSubmit={enter} style={{ maxWidth: 460 }}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} autoComplete="email" autoFocus />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.submit} style={{ background: "var(--blue)", color: "#fff" }} disabled={busy}>
          {busy ? "Checking…" : "Enter Le Kiosque"}
        </button>
        <p className={styles.fine}>
          Not a member yet? <Link href="/kiosque#join" style={{ color: "var(--bordeaux)", fontWeight: 700, textDecoration: "underline" }}>Join for $45 CAD / month</Link>
        </p>
      </form>
    </div>
  );
}
