import type { MetadataRoute } from "next";
import { resources } from "@/lib/data";
import { RESOURCES_COMING_SOON } from "@/lib/config";

// Public, indexable pages only — admin/student-hub (auth-gated) and the
// bare auth screens (login, forgot/reset-password, /auth/*) are
// deliberately excluded, they're not content for search engines to list.
//
// Hardcoded to the apex domain rather than reusing NEXT_PUBLIC_SITE_URL:
// that env var is pinned to https://www.xn--thefranaishub-ogb.com (the
// exact origin Supabase's Auth redirect allowlist expects — see
// app/api/auth/forgot-password/route.ts, lib/studentAccount.ts), so
// changing it would break password-reset/setup links. The apex 308s to
// the www origin (see Vercel → Domains), so search engines will resolve
// these to the canonical URL either way.
const SITE_URL = "https://xn--thefranaishub-ogb.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/courses`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/find-your-batch`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/le-hub`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/results`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/tef-tcf`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/delf`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/resources`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  // Individual resource pages redirect back to /resources while the
  // catalog is in its "Coming Soon" state (see lib/config.ts) — leaving
  // them out here too so nothing points search engines at a redirect.
  // They come back automatically once the flag flips off.
  const resourcePages: MetadataRoute.Sitemap = RESOURCES_COMING_SOON
    ? []
    : resources.map((r) => ({
        url: `${SITE_URL}/resources/${r.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      }));

  return [...staticPages, ...resourcePages];
}
