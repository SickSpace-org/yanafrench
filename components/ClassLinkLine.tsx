"use client";

import { useState } from "react";
import styles from "./ClassLinkLine.module.css";

// The class meeting link written out under a "Join class" button, with a
// Copy button — so students can always get the link from their dashboard.
export function ClassLinkLine({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the link is still visible to select by hand
    }
  }

  return (
    <div className={styles.line}>
      <span className={styles.label}>Class link</span>
      <a href={url} target="_blank" rel="noreferrer" className={styles.url} title={url}>
        {url.replace(/^https?:\/\//, "")}
      </a>
      <button type="button" className={styles.copy} onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
