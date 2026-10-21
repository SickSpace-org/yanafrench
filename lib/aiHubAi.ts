// Server-only. Every Gemini call behind Le Kiosque, in one place: the
// translator, pronunciation phrase + audio scoring, the daily quiz and the
// daily news. Same model and structured-output approach as
// lib/speakingEval.ts and app/api/quiz/generate.

import { google } from "@ai-sdk/google";
import { APICallError, RetryError, generateText, Output } from "ai";
import { z } from "zod";
import type {
  AiHubLevel,
  NewsArticle,
  NewsExtras,
  PronunciationEvaluation,
  PronunciationPhrase,
  TranslationResult,
} from "./aiHubData";

// Cheapest Gemini tier at low thinking effort — these are short, structured
// tasks, so deeper reasoning would only add cost and latency.
const MODEL = "gemini-3.5-flash-lite";
// Appended to every system prompt: at low effort the model sometimes drops
// French accents, which is unacceptable in a learning product.
const ACCENTS = " Always write French with every accent and diacritic exactly as in correct spelling (é è ê à â ç î ô û ù œ ë ï), never stripped.";
const LOW_EFFORT = { google: { thinkingConfig: { thinkingLevel: "low" } } } as const;

export class AiRateLimitError extends Error {}

// Gemini's 429 comes back wrapped in a RetryError; surface it as our own
// type so routes can answer 429 instead of a generic 500.
async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const cause = RetryError.isInstance(error) ? error.lastError : error;
    if (APICallError.isInstance(cause) && cause.statusCode === 429) throw new AiRateLimitError("Rate limited");
    throw error;
  }
}

// ── Translation ──────────────────────────────────────────────────────────
const translationSchema = z.object({
  from: z.enum(["French", "English", "Other"]).describe("The language of the input text"),
  translation: z.string().describe("The translation: French input becomes English; English input becomes French"),
  notes: z.string().describe("One to three short sentences in English on grammar, register or nuance worth knowing. Empty string if nothing useful."),
  examples: z
    .array(z.object({ fr: z.string(), en: z.string() }))
    .max(3)
    .describe("Up to 3 short natural example sentences using the key French word or structure, with English translations"),
  keyWords: z
    .array(z.object({ term: z.string().describe("French word or phrase"), meaning: z.string().describe("English meaning") }))
    .max(5)
    .describe("The most useful French words/phrases from the text or its translation, for a learner to save"),
});

export async function translateText(text: string): Promise<TranslationResult> {
  return guarded(async () => {
    const { output } = await generateText({
      model: google(MODEL),
      providerOptions: LOW_EFFORT,
      system:
        "You are a precise French–English translator and tutor for learners. If the input is French, translate it " +
        "to natural English; if it is English, translate it to natural French; otherwise set from to Other and " +
        "translate to English. Keep notes brief and in English." + ACCENTS,
      prompt: text,
      output: Output.object({ schema: translationSchema }),
    });
    return output;
  });
}

// ── Pronunciation ────────────────────────────────────────────────────────
const phraseSchema = z.object({
  phrase: z.string().describe("One French sentence, 6–14 words, natural and useful in real life"),
  translation: z.string().describe("English translation"),
  tip: z.string().describe("One short English tip on the trickiest sound in the sentence (liaison, nasal vowel, silent letter, the French r...)"),
});

export async function generatePhrase(level: AiHubLevel, topic: string): Promise<PronunciationPhrase> {
  return guarded(async () => {
    const { output } = await generateText({
      model: google(MODEL),
      providerOptions: LOW_EFFORT,
      system:
        "You write short French sentences for pronunciation practice. Pick sentences that exercise real " +
        "pronunciation challenges at the given CEFR level, and vary the vocabulary and topic every time. The tip must only " +
        "mention words and sounds that actually appear in your sentence, and be one short, concrete sentence." + ACCENTS,
      prompt: `Level ${level}. ${topic ? `Topic: ${topic}.` : "Choose a fresh everyday topic."} Random seed: ${Math.random().toString(36).slice(2)}`,
      output: Output.object({ schema: phraseSchema }),
    });
    return output;
  });
}

const pronunciationSchema = z.object({
  transcript: z.string().describe("Exactly what the student said, in French as heard. If unintelligible, describe what's audible."),
  // Accepts up to 100 because the model sometimes answers out of 100 despite
  // the instructions; evaluatePronunciation() scales those back to 0-10.
  overall: z.number().min(0).max(100).describe("Overall score from 0 to 10 (one decimal). Never out of 100."),
  accuracy: z.number().min(0).max(100).describe("0 to 10: how accurately each sound and word matched the target sentence"),
  rhythm: z.number().min(0).max(100).describe("0 to 10: rhythm, liaison, stress on the final syllable and natural flow"),
  problemWords: z
    .array(
      z.object({
        word: z.string().describe("A word from the target sentence that was mispronounced"),
        issue: z.string().describe("What was off, in plain English"),
        howToSay: z.string().describe("A simple respelling or tip to fix it, e.g. 'roo' not 'rue' with a rounded 'u'"),
      })
    )
    .max(5),
  wellDone: z.string().describe("One or two encouraging sentences, specific to what they got right"),
  improve: z.string().describe("The single most useful thing to practise next"),
});

export async function evaluatePronunciation(
  phrase: string,
  audio: Buffer,
  mediaType: string,
  level?: AiHubLevel,
  monologue = false
): Promise<PronunciationEvaluation> {
  return guarded(async () => {
    const { output } = await generateText({
      model: google(MODEL),
      providerOptions: LOW_EFFORT,
      system:
        "You are a kind, exacting French speaking coach. Listen to the audio and judge the actual sounds " +
        "(vowels, nasals, the French r, liaisons, silent letters, stress), not just whether the words were right. " +
        (monologue
          ? "The student is speaking freely on a topic, so there is no target text: judge pronunciation, fluency and flow, and whether they stayed on topic. " +
            "Accuracy means clarity and correctness of sounds; problemWords are words they actually said that were mispronounced. "
          : "Compare against the target sentence. ") +
        "Score every number from 0 to 10 (NOT out of 100). Write feedback in English; keep French examples in French." + ACCENTS,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: monologue
                ? `The student (level ${level ?? "A2"}) was asked to speak in French for about a minute on this topic: "${phrase}"\n\nListen to their recording and evaluate their speaking.`
                : `The student was asked to read this sentence aloud: "${phrase}"\n\nListen to their recording and evaluate their pronunciation.`,
            },
            { type: "file", mediaType, data: audio },
          ],
        },
      ],
      output: Output.object({ schema: pronunciationSchema }),
    });
    // A score above 10 means the model used a 0-100 scale: bring it back to 0-10.
    const to10 = (n: number) => Math.round(Math.min(10, n > 10 ? n / 10 : n) * 10) / 10;
    return { ...output, overall: to10(output.overall), accuracy: to10(output.accuracy), rhythm: to10(output.rhythm) };
  });
}

// ── Daily quiz ───────────────────────────────────────────────────────────
// Flat schema (no union) — Gemini doesn't reliably honor per-variant shapes.
const quizQuestionSchema = z.object({
  type: z.enum(["mcq", "fillBlank"]),
  prompt: z.string().describe("The question in French at the given level. For fillBlank, a sentence with ____ where the answer goes."),
  choices: z.array(z.string()).describe("Exactly 4 distinct French answer choices when type=mcq, otherwise an empty array"),
  correctAnswer: z.string().describe("The correct answer. For mcq it must match one of choices verbatim."),
  acceptableAnswers: z.array(z.string()).describe("Other accepted spellings for fillBlank (include correctAnswer); empty array for mcq"),
  explanation: z.string().describe("One sentence in English explaining why the answer is correct"),
});

const quizSchema = z.object({
  questions: z
    .array(quizQuestionSchema)
    .length(8)
    .describe("Exactly 8 questions: 5 mcq and 3 fillBlank, mixing grammar, vocabulary and reading, on varied topics"),
});

export type StoredQuizQuestion = z.infer<typeof quizQuestionSchema> & { id: string };

export async function generateQuiz(level: AiHubLevel, date: string): Promise<StoredQuizQuestion[]> {
  return guarded(async () => {
    const { output } = await generateText({
      model: google(MODEL),
      providerOptions: LOW_EFFORT,
      system:
        "You write the Daily French Quiz for adult learners (TEF/TCF/DELF style). Questions are in French, " +
        "explanations in English. Make every day different: new topics, vocabulary and scenarios. Each question " +
        "must have exactly one defensible answer." + ACCENTS,
      prompt: `Write the quiz for ${date} at CEFR level ${level}.`,
      output: Output.object({ schema: quizSchema }),
    });
    return output.questions.map((q, i) => ({ ...q, id: `q${i + 1}` }));
  });
}

// ── Daily news ───────────────────────────────────────────────────────────
const newsSchema = z.object({
  articles: z
    .array(
      z.object({
        level: z.enum(["A2", "B1", "B2"]),
        title: z.string().describe("Headline in French"),
        summary: z.string().describe("One sentence in English saying what the article is about"),
        paragraphs: z.array(z.string()).min(3).max(5).describe("The article in French, 3–5 short paragraphs, written for the stated level"),
        glossary: z
          .array(z.object({ fr: z.string(), en: z.string() }))
          .min(3)
          .max(10)
          .describe("5 to 8 of the hardest or most useful words/phrases from the article with English meanings"),
        topic: z.string().describe("One or two words: e.g. Technology, Sport, Environment, Culture"),
      })
    )
    .length(3)
    .describe("Exactly three articles on three DIFFERENT news stories, one each at A2, B1 and B2"),
  wordOfDay: z.object({
    fr: z.string().describe("One useful French word (with its article if a noun), not a beginner word like 'bonjour'"),
    en: z.string(),
    example: z.string().describe("A natural French example sentence"),
    exampleEn: z.string(),
  }),
  expression: z.object({
    fr: z.string().describe("A common French idiom or expression"),
    en: z.string().describe("Natural English equivalent"),
    meaning: z.string().describe("One short sentence on when and how it is used"),
  }),
  fact: z.object({
    title: z.string().describe("Short title, in English"),
    text: z.string().describe("Two or three sentences in English about French language, culture, Canada/France life or etymology — accurate and surprising"),
  }),
});

export async function generateNews(date: string): Promise<{ articles: NewsArticle[]; extras: NewsExtras }> {
  // Step 1: ground the day's stories in a real web search. Best-effort — if
  // the search tool isn't available the articles are still written, just
  // without fresh headlines to draw on.
  let headlines = "";
  try {
    const { text } = await guarded(() =>
      generateText({
        model: google(MODEL),
      providerOptions: LOW_EFFORT,
        tools: { google_search: google.tools.googleSearch({}) },
        prompt:
          `Today is ${date}. Search the web for the most notable news from the last 24 hours (world, Canada, France, ` +
          "science, culture, sport). List 6 distinct stories, each as one line: the topic and the key facts, " +
          "factual and neutral. Prefer French-language sources where possible.",
      })
    );
    headlines = text.trim();
  } catch (error) {
    // Any failure here (including the search tool's own quota) just means no
    // fresh headlines; the write-up below still runs and has its own errors.
    console.error("News search grounding failed — writing without fresh headlines", error);
  }

  // Step 2: write the three graded articles from those stories.
  return guarded(async () => {
    const { output } = await generateText({
      model: google(MODEL),
      providerOptions: LOW_EFFORT,
      system:
        "You write the Daily French News for learners. Write original articles in your own words — never copy " +
        "sentences from sources. Stay factual and neutral; do not invent quotes or statistics. A2 uses short " +
        "present-tense sentences and common words; B1 adds past tenses and connectors; B2 uses richer " +
        "vocabulary and complex sentences. If no stories are supplied, write about timeless, general-interest " +
        "topics and avoid claiming anything happened 'today'." + ACCENTS,
      prompt: headlines
        ? `Date: ${date}\n\nToday's stories:\n${headlines}\n\nWrite three articles, each on a different story, plus the word of the day, an expression and a language/culture fact.`
        : `Date: ${date}\n\nNo headlines available. Write three general-interest articles.`,
      output: Output.object({ schema: newsSchema }),
    });
    const { articles, wordOfDay, expression, fact } = output;
    return { articles, extras: { wordOfDay, expression, fact } };
  });
}
