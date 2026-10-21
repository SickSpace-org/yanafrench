"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AI_HUB_PRICE_CAD, aiHubJoinWhatsappUrl } from "@/lib/aiHubData";
import styles from "./AiHubLanding.module.css";

const FEATURES = [
  { n: "01", title: "AI Pronunciation", text: "Hear a sentence, say it out loud, and get feedback on your real sounds — the French r, nasals, liaisons — with word-by-word fixes." },
  { n: "02", title: "AI Translate & Library", text: "Translate French ⇄ English with grammar notes and examples, then save words to a personal library you can search any time." },
  { n: "03", title: "AI Daily Quiz", text: "A fresh quiz written for your level every day. Instant marking, explanations, and a streak to keep you coming back." },
  { n: "04", title: "AI Daily News", text: "Today's stories in French at A2, B1 and B2, each with a glossary and a read-aloud button — real French for real habits." },
];

// Public sales page for Le Kiosque. "Join" saves a pending
// request (so Yana sees it in Admin -> Le Kiosque) and opens WhatsApp with the
// payment message pre-filled — no online payment.
export function AiHubLanding() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);

  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-hub/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, whatsapp }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || "Something went wrong. Please try again.");
        return;
      }
      const url = aiHubJoinWhatsappUrl(fullName.trim(), email.trim().toLowerCase());
      setWaUrl(url);
      // Straight into WhatsApp. A same-tab navigation (not window.open) so a
      // popup blocker can't stop it after the async request above.
      window.location.assign(url);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>LE KIOSQUE</span>
        <h1>
          Your French,
          <br />
          <em>practised daily by AI.</em>
        </h1>
        <p>
          A separate membership for learners who want daily practice between lessons — pronunciation coaching, instant translation, a daily quiz and daily
          French news. No class enrolment needed.
        </p>
      </section>

      <div className={styles.grid}>
        {FEATURES.map((f) => (
          <article key={f.n} className={styles.feature}>
            <span>{f.n}</span>
            <h2>{f.title}</h2>
            <p>{f.text}</p>
          </article>
        ))}
      </div>

      <section className={styles.join} id="join">
        <div className={styles.joinCopy}>
          <h2>One simple membership.</h2>
          <p className={styles.price}>
            ${AI_HUB_PRICE_CAD}
            <small>CAD / month</small>
          </p>
          <ol className={styles.steps}>
            <li>Fill in the form and we open WhatsApp with your message to Yana.</li>
            <li>Yana sends you the payment details and confirms when she receives your payment.</li>
            <li>You get an email to set your password — then everything unlocks for 30 days.</li>
          </ol>
          <p className={styles.login}>
            Already a member? <Link href="/login" style={{ color: "#fff", textDecoration: "underline", fontWeight: 700 }}>Log in</Link>
          </p>
        </div>

        {waUrl ? (
          <div className={`${styles.form} ${styles.done}`}>
            <h3>Request saved.</h3>
            <p>WhatsApp should open now. If it didn&rsquo;t, tap the button to message Yana and finish the payment.</p>
            <a className={styles.submit} style={{ textAlign: "center" }} href={waUrl} target="_blank" rel="noreferrer">
              Open WhatsApp
            </a>
          </div>
        ) : (
          <form className={styles.form} onSubmit={join}>
            <label>
              Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} autoComplete="name" />
            </label>
            <label>
              Email (this will be your login)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} autoComplete="email" />
            </label>
            <label>
              WhatsApp number
              <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={40} autoComplete="tel" placeholder="+1 416 555 0100" />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? "Saving…" : `Join for $${AI_HUB_PRICE_CAD} CAD / month — message on WhatsApp`}
            </button>
            <p className={styles.fine}>No payment is taken on this site. You pay Yana directly after she replies on WhatsApp.</p>
          </form>
        )}
      </section>
    </div>
  );
}
