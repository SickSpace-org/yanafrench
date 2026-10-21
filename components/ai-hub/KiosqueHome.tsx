"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LibraryWord, NewsArticle, NewsEdition, AiQuizState } from "@/lib/aiHubData";
import { aiFetch, errorMessage, speakFrench } from "./aiHubClient";
import styles from "./KiosqueHome.module.css";

type QuizSummary = AiQuizState | { needsLevel: true; streak: number };

const NEWS_HREF = "/kiosque/app/news";

// Le Kiosque front page: today's French news scattered across the page like
// a newsstand, with a column of things to do beside it.
export function KiosqueHome({ firstName }: { firstName: string }) {
  const [news, setNews] = useState<NewsEdition | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizSummary | null>(null);
  const [wordCount, setWordCount] = useState<number | null>(null);

  useEffect(() => {
    aiFetch<NewsEdition>("/api/ai-hub/news").then(setNews).catch((err) => setNewsError(errorMessage(err)));
    aiFetch<QuizSummary>("/api/ai-hub/quiz").then(setQuiz).catch(() => {});
    aiFetch<LibraryWord[]>("/api/ai-hub/library").then((w) => setWordCount(w.length)).catch(() => {});
  }, []);

  const today = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" }).format(new Date());
  const byLevel = (level: NewsArticle["level"]) => news?.articles.find((a) => a.level === level);
  const lead = byLevel("B1");
  const a2 = byLevel("A2");
  const b2 = byLevel("B2");
  const extras = news?.extras;

  const quizDone = quiz && "completed" in quiz && quiz.completed;
  const streak = quiz?.streak ?? 0;

  return (
    <div className={styles.layout}>
      <section aria-label="Today's news">
        <header className={styles.masthead}>
          <div className={styles.dateline}>
            <span>{today}</span>
            <span>Édition du jour</span>
          </div>
          <h1 className={styles.title}>
            {firstName ? `Bonjour, ${firstName}.` : "Bonjour."} <em>Voici le journal.</em>
          </h1>
          <p className={styles.lede}>Today&rsquo;s stories in French at three levels, a word and an expression to steal, and one thing you didn&rsquo;t know about the language.</p>
        </header>

        <div className={styles.scatter}>
          {!news && !newsError && (
            <>
              <div className={`${styles.skel} ${styles.lead}`} style={{ border: 0 }} />
              <div className={`${styles.skel} ${styles.word}`} style={{ transform: "none" }} />
              <div className={`${styles.skel} ${styles.a2}`} />
              <p className={styles.note}>Setting today&rsquo;s front page… the first visit of the day can take up to a minute.</p>
            </>
          )}
          {newsError && <p className={styles.err}>{newsError}</p>}

          {lead && <ArticleCard article={lead} className={`${styles.card} ${styles.lead}`} lead />}
          {extras && (
            <div className={`${styles.card} ${styles.word}`}>
              <span className={styles.kicker}>Mot du jour</span>
              <p className={styles.big}>{extras.wordOfDay.fr}</p>
              <p className={styles.sub}>{extras.wordOfDay.en}</p>
              <p className={styles.example}>
                {extras.wordOfDay.example}
                <span>{extras.wordOfDay.exampleEn}</span>
              </p>
              <button type="button" className={styles.speak} onClick={() => speakFrench(extras.wordOfDay.example)}>
                ▶ Écouter
              </button>
            </div>
          )}
          {a2 && <ArticleCard article={a2} className={`${styles.card} ${styles.a2}`} />}
          {extras && (
            <div className={`${styles.card} ${styles.expr}`}>
              <span className={styles.kicker}>Expression</span>
              <p className={styles.big} style={{ fontSize: "1.5rem" }}>&ldquo;{extras.expression.fr}&rdquo;</p>
              <p className={styles.sub}>{extras.expression.en}</p>
              <p className={styles.cardText}>{extras.expression.meaning}</p>
              <button type="button" className={styles.speak} onClick={() => speakFrench(extras.expression.fr, true)}>
                ▶ Écouter
              </button>
            </div>
          )}
          {b2 && <ArticleCard article={b2} className={`${styles.card} ${styles.b2}`} />}
          {extras && (
            <div className={`${styles.card} ${styles.fact}`}>
              <h3>{extras.fact.title}</h3>
              <p>{extras.fact.text}</p>
            </div>
          )}
        </div>
      </section>

      <aside className={styles.side} aria-label="Things to do">
        <div className={styles.group}>
          <div className={styles.groupHead}>
            <h2 className={styles.groupTitle}>À faire aujourd&rsquo;hui</h2>
            {streak > 0 && <span className={styles.streak}>🔥 {streak}-day streak</span>}
          </div>
          <Todo
            href="/kiosque/app/quiz"
            title="Daily quiz"
            text={quizDone ? `Done — ${quiz.score}/${quiz.questions.length}. Back tomorrow.` : "Eight questions at your level. Keep the streak alive."}
            done={Boolean(quizDone)}
            go={quizDone ? "Review answers" : "Start the quiz"}
          />
          <Todo href={NEWS_HREF} title="Read today's news" text="One article at your level, then check the glossary." go="Open the news" />
          <Todo href="/kiosque/app/pronunciation" title="Practise speaking" text="Read a sentence or talk on a topic, and get feedback." go="Start speaking" />
          <Todo
            href="/kiosque/app/library?tab=translate"
            title="Translate & save words"
            text="Look something up and save it to your library."
            go="Open translator"
          />
        </div>

        <div className={styles.group}>
          <div className={styles.groupHead}>
            <h2 className={styles.groupTitle}>Ma bibliothèque</h2>
          </div>
          <Todo
            href="/kiosque/app/library?tab=library"
            title={wordCount === null ? "Saved words" : `${wordCount} saved word${wordCount === 1 ? "" : "s"}`}
            text="Search, hear and review the words you've collected."
            go="Open library"
          />
        </div>
      </aside>
    </div>
  );
}

function ArticleCard({ article, className, lead = false }: { article: NewsArticle; className: string; lead?: boolean }) {
  return (
    <Link href={`${NEWS_HREF}?level=${article.level}`} className={className}>
      <span className={`${styles.tag} ${lead ? styles.leadTag : ""}`}>
        {article.level} · {article.topic.toUpperCase()}
      </span>
      <h2 className={lead ? styles.leadTitle : styles.cardTitle}>{article.title}</h2>
      <p className={lead ? styles.leadText : styles.cardText}>{article.paragraphs[0]}</p>
      <span className={`${styles.more} ${lead ? styles.leadMore : ""}`}>Lire l&rsquo;article →</span>
    </Link>
  );
}

function Todo({ href, title, text, go, done = false }: { href: string; title: string; text: string; go: string; done?: boolean }) {
  return (
    <Link href={href} className={`${styles.todo} ${done ? styles.done : ""}`}>
      <span className={styles.box} aria-hidden="true">✓</span>
      <span className={styles.todoBody}>
        <span className={styles.todoTitle}>{title}</span>
        <span className={styles.todoText}>{text}</span>
        <span className={styles.todoGo}>{go} →</span>
      </span>
    </Link>
  );
}
