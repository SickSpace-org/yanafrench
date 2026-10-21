import { aiHubToday } from "@/lib/aiHub";
import { getOrCreateNews } from "@/lib/aiHubNews";

export const maxDuration = 120;

// Daily Le Kiosque news run, triggered by the Vercel cron in vercel.json. It
// writes today's edition ahead of the first member, and is a no-op if the
// edition already exists, so a retried or duplicate run costs nothing.
//
// Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set
// in the project's env vars; any other caller is rejected.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }

  try {
    const edition = await getOrCreateNews(aiHubToday());
    return Response.json({ ok: true, date: edition.date, articles: edition.articles.length });
  } catch (err) {
    console.error("Le Kiosque news cron failed", err);
    return new Response("Failed to write today's news.", { status: 500 });
  }
}
