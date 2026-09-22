import type { MetadataRoute } from "next";
import { resources } from "@/lib/data";
import { RESOURCES_COMING_SOON } from "@/lib/config";

// Public, indexable pages only — admin/student-hub (auth-gated) and the
// bare auth screens (login, forgot/reset-password, /auth/*) are
// deliberately excluded, they're not content for search engines to list.
//
// Same env var + fallback chain as app/api/auth/forgot-password/route.ts
// and lib/studentAccount.ts — one source of truth for the canonical
// origin. It's pinned to https://www.xn--thefranaishub-ogb.com (the exact
// host Supabase's Auth redirect allowlist expects), which is also the
// canonical www host the bare apex domain 308s to — using the apex here
// would cost every sitemap URL a redirect hop for no reason.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";

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
