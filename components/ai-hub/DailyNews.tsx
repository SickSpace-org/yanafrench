"use client";

import { useEffect, useState } from "react";
import type { NewsArticle, NewsEdition } from "@/lib/aiHubData";
import { aiFetch, errorMessage, speakFrench } from "./aiHubClient";
import styles from "./AiHubApp.module.css";

// AI Daily News: today's three French articles at A2 / B1 / B2, each with a
// glossary. Written once a day and shared by every member.
export function DailyNews() {
  const [edition, setEdition] = useState<NewsEdition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<NewsArticle["level"]>("A2");

  useEffect(() => {
    // Front-page cards link here with ?level=B1.
    const wanted = new URLSearchParams(window.location.search).get("level");
    if (wanted === "A2" || wanted === "B1" || wanted === "B2") setOpen(wanted);
    aiFetch<NewsEdition>("/api/ai-hub/news")
      .then(setEdition)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const date = edition
    ? new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" }).format(new Date(`${edition.date}T12:00:00Z`))
    : "";

  return (
    <div className={styles.narrow}>
      <div className={styles.head}>
        <small>DAILY NEWS</small>
        <h1>
          Today in French.
          <br />
          <em>{date || "Chargement…"}</em>
        </h1>
        <p>Three stories, three levels. Read the one that suits you, check the glossary, and listen to it read aloud.</p>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {!edition && !error && <p className={styles.empty}>Preparing today&rsquo;s news… this can take up to a minute the first time each day.</p>}

      {edition && (
        <>
          <div className={styles.tabs} role="tablist">
            {edition.articles.map((a) => (
              <button
                key={a.level}
                type="button"
                role="tab"
                aria-selected={open === a.level}
                className={`${styles.tab} ${open === a.level ? styles.tabActive : ""}`}
                onClick={() => setOpen(a.level)}
              >
                {a.level}
              </button>
            ))}
          </div>
          {edition.articles
            .filter((a) => a.level === open)
            .map((a) => (
              <Article key={a.level} article={a} />
            ))}
        </>
      )}
    </div>
  );
}

function Article({ article }: { article: NewsArticle }) {
  const [showSummary, setShowSummary] = useState(false);
  return (
    <article className={`${styles.card} ${styles.article}`}>
      <div className={styles.articleHead}>
        <span className={styles.level}>{article.level}</span>
        <span className={styles.muted}>{article.topic}</span>
      </div>
      <h2 className={styles.articleTitle}>{article.title}</h2>
      <div className={styles.row} style={{ marginBottom: "1rem" }}>
        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => speakFrench(`${article.title}. ${article.paragraphs.join(" ")}`, article.level === "A2")}>
          ▶ Read aloud
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => setShowSummary((s) => !s)}>
          {showSummary ? "Hide English summary" : "English summary"}
        </button>
      </div>
      {showSummary && <p className={styles.translateBox}>{article.summary}</p>}
      <div className={styles.articleBody}>
        {article.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <h3 className={styles.cardTitle} style={{ marginTop: "1.2rem" }}>Glossary</h3>
      <ul className={styles.glossary}>
        {article.glossary.map((g, i) => (
          <li key={i}>
            <strong>{g.fr}</strong> — {g.en}
          </li>
        ))}
      </ul>
    </article>
  );
}
