import type { MetadataRoute } from "next";

// Same source of truth as app/sitemap.ts.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Prefix-matched by robots.txt convention, so each entry also
      // covers everything nested under it (/admin/batches, /api/payment,
      // /student-hub/settings, etc.) — cross-checked against the actual
      // app/ route tree, not guessed: /admin/** and /student-hub/** are
      // the two proxy.ts-gated areas, /api/** is every backend route
      // (including the payment/webhook endpoints), and /auth/** is
      // server-side redirect/processing handlers (callback, confirm,
      // signout), not content.
      disallow: ["/admin", "/student-hub", "/api", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
