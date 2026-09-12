"use client";

import { useMemo, useState, type FormEvent } from "react";
import { getVocabulary, vocabCategories, type VocabWord } from "@/lib/vocabData";
import { useVocabState } from "@/lib/useVocabState";
import { DashboardShell } from "./DashboardShell";
import styles from "./VocabularyPage.module.css";

type View = "all" | "favorites" | "flashcards";

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9à-ÿ]+/g, "-").replace(/(^-|-$)/g, "");
}

export function VocabularyPage() {
  const baseWords = getVocabulary();
  const { savedWords, favoriteIds: favorites, saveWord, toggleFavorite } = useVocabState();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof vocabCategories)[number]>("All");
  const [view, setView] = useState<View>("all");
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const [translating, setTranslating] = useState(false);
  const [translateResult, setTranslateResult] = useState<{ word: string; meaning: string } | null>(null);
  const [translateError, setTranslateError] = useState("");
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  const words = useMemo(() => [...savedWords, ...baseWords], [savedWords, baseWords]);
  const recent = [...baseWords].slice(0, 4);

  const filtered = useMemo(() => {
    return words.filter((w) => {
      const matchesQuery = w.word.toLowerCase().includes(query.trim().toLowerCase()) || w.meaning.toLowerCase().includes(query.trim().toLowerCase());
      const matchesCategory = category === "All" || w.category === category;
      const matchesFavorites = view !== "favorites" || favorites.includes(w.id);
      return matchesQuery && matchesCategory && matchesFavorites;
    });
  }, [words, query, category, view, favorites]);

  const flashcardDeck = filtered.length > 0 ? filtered : words;
  const activeCard = flashcardDeck[cardIndex % flashcardDeck.length];

  function nextCard() {
    setFlipped(false);
    setCardIndex((i) => (i + 1) % flashcardDeck.length);
  }
  function prevCard() {
    setFlipped(false);
    setCardIndex((i) => (i - 1 + flashcardDeck.length) % flashcardDeck.length);
  }

  async function handleTranslate(e: FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (!term || translating) return;

    const existing = words.find((w) => w.word.toLowerCase() === term.toLowerCase());
    if (existing) {
      setTranslateResult(null);
      setTranslateError("");
      return;
    }

    setTranslating(true);
    setTranslateError("");
    setTranslateResult(null);
    setJustSavedId(null);
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=fr|en`);
      const data = await res.json();
      const translated: string | undefined = data?.responseData?.translatedText;
      if (translated && !/no translation/i.test(translated)) {
        setTranslateResult({ word: term, meaning: translated.toLowerCase() });
      } else {
        setTranslateError("No translation found for that word.");
      }
    } catch {
      setTranslateError("Couldn't reach the translator. Try again.");
    } finally {
      setTranslating(false);
    }
  }

  function handleSaveTranslation() {
    if (!translateResult) return;
    const newWord: VocabWord = {
      id: slugify(translateResult.word) || `word-${Date.now()}`,
      word: translateResult.word,
      pronunciation: "",
      meaning: translateResult.meaning,
      example: "",
      category: "Saved",
      dateLearned: new Date().toLocaleDateString("en-US", { day: "numeric", month: "short" }),
    };
    saveWord(newWord);
    setJustSavedId(newWord.id);
  }

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>LE HUB</small>
        <h1>Vocabulary.</h1>
        <p>Every word from class, organised and ready to review — or look up any French word and save it here.</p>
      </div>

      <div className={styles.viewTabs}>
        <button type="button" className={view === "all" ? styles.tabActive : styles.tab} onClick={() => setView("all")}>All words</button>
        <button type="button" className={view === "favorites" ? styles.tabActive : styles.tab} onClick={() => setView("favorites")}>Favorites</button>
        <button type="button" className={view === "flashcards" ? styles.tabActive : styles.tab} onClick={() => { setView("flashcards"); setCardIndex(0); setFlipped(false); }}>Flashcards</button>
      </div>

      {view !== "flashcards" && (
        <>
          <div className={styles.controls}>
            <form className={styles.searchForm} onSubmit={handleTranslate}>
              <input
                className={styles.search}
                placeholder="Search your words, or type any French word to translate…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setTranslateResult(null); setTranslateError(""); }}
                aria-label="Search or translate a French word"
              />
              <button type="submit" className={styles.translateButton} disabled={translating || !query.trim()}>
                {translating ? "…" : "Translate"}
              </button>
            </form>

            {(translateResult || translateError) && (
              <div className={styles.translateResult}>
                {translateResult ? (
                  <>
                    <div>
                      <span className={styles.translateLabel}>TRANSLATION</span>
                      <strong>{translateResult.word}</strong>
                      <span className={styles.translateArrow}>→</span>
                      <span className={styles.translateMeaning}>{translateResult.meaning}</span>
                    </div>
                    <button type="button" className={styles.saveTranslation} onClick={handleSaveTranslation} disabled={justSavedId === slugify(translateResult.word)}>
                      {justSavedId === slugify(translateResult.word) ? "✓ Saved" : "＋ Save to my words"}
                    </button>
                  </>
                ) : (
                  <p className={styles.translateError}>{translateError}</p>
                )}
              </div>
            )}

            <div className={styles.filterRow}>
              {vocabCategories.map((c) => (
                <button key={c} type="button" className={category === c ? styles.chipActive : styles.chip} onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
          </div>

          {view === "all" && query.trim() === "" && category === "All" && (
            <div className={styles.section}>
              <h2>Recently learned</h2>
              <div className={styles.grid}>
                {recent.map((w) => (
                  <div key={w.id} className={styles.card}>
                    <button type="button" className={favorites.includes(w.id) ? styles.favActive : styles.fav} onClick={() => toggleFavorite(w.id)} aria-label="Toggle favorite">★</button>
                    <span className={styles.category}>{w.category}</span>
                    <strong>{w.word}</strong>
                    {w.pronunciation && <small className={styles.pron}>/{w.pronunciation}/</small>}
                    <p className={styles.meaning}>{w.meaning}</p>
                    {w.example && <p className={styles.example}>{w.example}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.section}>
            <h2>{view === "favorites" ? "Favorites" : "All words"}</h2>
            {filtered.length > 0 ? (
              <div className={styles.grid}>
                {filtered.map((w) => (
                  <div key={w.id} className={styles.card}>
                    <button type="button" className={favorites.includes(w.id) ? styles.favActive : styles.fav} onClick={() => toggleFavorite(w.id)} aria-label="Toggle favorite">★</button>
                    <span className={styles.category}>{w.category}</span>
                    <strong>{w.word}</strong>
                    {w.pronunciation && <small className={styles.pron}>/{w.pronunciation}/</small>}
                    <p className={styles.meaning}>{w.meaning}</p>
                    {w.example && <p className={styles.example}>{w.example}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}><p>{view === "favorites" ? "No favorites yet — star a word to save it here." : "No words match — try translating it above."}</p></div>
            )}
          </div>
        </>
      )}

      {view === "flashcards" && activeCard && (
        <div className={styles.flashcardWrap}>
          <button type="button" className={styles.flashcard} onClick={() => setFlipped((f) => !f)}>
            {!flipped ? (
              <>
                <span className={styles.category}>{activeCard.category}</span>
                <strong className={styles.flashWord}>{activeCard.word}</strong>
                {activeCard.pronunciation && <small className={styles.pron}>/{activeCard.pronunciation}/</small>}
                <span className={styles.flipHint}>Tap to reveal meaning</span>
              </>
            ) : (
              <>
                <p className={styles.meaning}>{activeCard.meaning}</p>
                {activeCard.example && <p className={styles.example}>{activeCard.example}</p>}
                <span className={styles.flipHint}>Tap to flip back</span>
              </>
            )}
          </button>
          <div className={styles.flashNav}>
            <button type="button" onClick={prevCard}>← Previous</button>
            <span>{(cardIndex % flashcardDeck.length) + 1} / {flashcardDeck.length}</span>
            <button type="button" onClick={nextCard}>Next →</button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
