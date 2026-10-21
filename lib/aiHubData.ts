// Le Kiosque types and pure helpers shared by the client and the API routes. No
// server-only imports here (see lib/aiHub.ts for those).

import { whatsappUrl } from "./site";

export const AI_HUB_PRICE_CAD = 45;
export const AI_HUB_PERIOD_DAYS = 30;
export const AI_HUB_PRICE_LABEL = `$${AI_HUB_PRICE_CAD} CAD / month`;

export const AI_HUB_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type AiHubLevel = (typeof AI_HUB_LEVELS)[number];

export function isAiHubLevel(value: unknown): value is AiHubLevel {
  return typeof value === "string" && (AI_HUB_LEVELS as readonly string[]).includes(value);
}

// The message the "Join" button pre-fills in WhatsApp.
export function aiHubJoinWhatsappUrl(name: string, email: string): string {
  return whatsappUrl(
    `Hi Yana! I'd like to join Le Kiosque (${AI_HUB_PRICE_LABEL}).\nName: ${name}\nEmail: ${email}\nPlease send me the payment details.`
  );
}

export type AiHubMemberStatus = "pending" | "active" | "deactivated";

export type AiHubMemberRow = {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  status: AiHubMemberStatus;
  expires_at: string | null;
  requested_at: string;
};

export const AI_HUB_MEMBER_COLUMNS = "id, full_name, email, whatsapp, status, expires_at, requested_at";

// What Admin -> Le Kiosque shows. `access` is derived from status + expiry so
// the page never has to re-implement the rule.
export type AiHubAccess = "pending" | "active" | "expired" | "deactivated";

export type AdminAiHubMember = {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string;
  status: AiHubMemberStatus;
  access: AiHubAccess;
  expiresAt: string | null;
  daysLeft: number;
  requestedAt: string;
  // Has Yana confirmed a payment for this person at least once?
  hasPaid: boolean;
};

export function daysUntil(iso: string | null, now = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000));
}

export function accessFor(status: AiHubMemberStatus, expiresAt: string | null, now = Date.now()): AiHubAccess {
  if (status === "pending") return "pending";
  if (status === "deactivated") return "deactivated";
  return expiresAt && new Date(expiresAt).getTime() > now ? "active" : "expired";
}

export function memberFromRow(row: AiHubMemberRow): AdminAiHubMember {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    whatsapp: row.whatsapp,
    status: row.status,
    access: accessFor(row.status, row.expires_at),
    expiresAt: row.expires_at,
    daysLeft: daysUntil(row.expires_at),
    requestedAt: row.requested_at,
    hasPaid: row.expires_at !== null,
  };
}

// ── Translation + library ────────────────────────────────────────────────
export type TranslationResult = {
  from: "French" | "English" | "Other";
  translation: string;
  notes: string;
  examples: { fr: string; en: string }[];
  keyWords: { term: string; meaning: string }[];
};

export type LibraryWord = { id: string; term: string; meaning: string; note: string; createdAt: string };

// ── Pronunciation ────────────────────────────────────────────────────────
export type PronunciationPhrase = { phrase: string; translation: string; tip: string };

export type PronunciationEvaluation = {
  transcript: string;
  overall: number;
  accuracy: number;
  rhythm: number;
  problemWords: { word: string; issue: string; howToSay: string }[];
  wellDone: string;
  improve: string;
};

export type PronunciationAttempt = {
  id: string;
  phrase: string;
  evaluation: PronunciationEvaluation;
  createdAt: string;
};

// ── Daily quiz ───────────────────────────────────────────────────────────
export type AiQuizQuestion = {
  id: string;
  type: "mcq" | "fillBlank";
  prompt: string;
  choices: string[]; // empty for fillBlank
};

export type AiQuizResult = {
  id: string;
  correct: boolean;
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
};

export type AiQuizState = {
  date: string;
  level: AiHubLevel;
  questions: AiQuizQuestion[];
  completed: boolean;
  score: number | null;
  results: AiQuizResult[] | null;
  streak: number;
};

// ── Daily news ───────────────────────────────────────────────────────────
export type NewsArticle = {
  level: "A2" | "B1" | "B2";
  title: string;
  summary: string; // one line, English
  paragraphs: string[]; // French
  glossary: { fr: string; en: string }[];
  topic: string;
};

// The small "more about French" pieces beside the articles on the home page.
export type NewsExtras = {
  wordOfDay: { fr: string; en: string; example: string; exampleEn: string };
  expression: { fr: string; en: string; meaning: string };
  fact: { title: string; text: string };
};

// `extras` is optional so an edition written before it existed still loads.
export type NewsEdition = { date: string; articles: NewsArticle[]; extras?: NewsExtras };

// ── Speaking topics (added by the admin) ─────────────────────────────────
export type AiHubTopic = { id: string; topic: string; points: string; createdAt: string };
