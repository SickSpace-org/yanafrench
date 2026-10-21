// Server-only. Today's Le Kiosque news: one edition per day, shared by every
// member. Written by the daily cron (app/api/cron/ai-hub-news); if the first
// member of the day arrives before it has run, they trigger it instead.

import { getSupabaseAdmin } from "./supabaseAdmin";
import { generateNews } from "./aiHubAi";
import type { NewsArticle, NewsEdition, NewsExtras } from "./aiHubData";

export async function readNews(date: string): Promise<NewsEdition | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from("ai_hub_news").select("news_date, articles").eq("news_date", date).maybeSingle();
  if (!data) return null;
  // The articles column holds { articles, extras }; an older edition may be a bare array.
  const stored = data.articles as NewsArticle[] | { articles: NewsArticle[]; extras?: NewsExtras };
  return Array.isArray(stored)
    ? { date: data.news_date as string, articles: stored }
    : { date: data.news_date as string, articles: stored.articles, extras: stored.extras };
}

// Returns today's edition, generating it if it doesn't exist yet. Safe to
// call concurrently: the insert is keyed by date, and a loser of the race
// just reads the winner's edition.
export async function getOrCreateNews(date: string): Promise<NewsEdition> {
  const existing = await readNews(date);
  if (existing) return existing;

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase isn't configured.");

  const edition = await generateNews(date);
  const { error } = await supabase.from("ai_hub_news").insert({ news_date: date, articles: edition });
  if (error && error.code !== "23505") throw error;
  return (await readNews(date)) ?? { date, ...edition };
}
