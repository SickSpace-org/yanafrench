export const site = {
  name: "The Français Hub",
  tutor: "Yana Budhiraja",
  phone: "919870416446",
  instagram: "https://www.instagram.com/the.francaishub_/",
  linkedin: "https://www.linkedin.com/in/yana-budhiraja-234654284/",
};

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Same env var + fallback chain as app/sitemap.ts, app/robots.ts and
// app/layout.tsx's metadataBase — one source of truth for the canonical
// origin, reused anywhere a page needs an absolute URL (canonical links,
// OpenGraph, JSON-LD).
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";

// Undefined (not a fallback string) when unset, since there's no sane
// default GA4 property to fall back to — components using this should
// just skip rendering analytics rather than send events to a fake ID.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function asset(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalized}`;
}

export function whatsappUrl(message = "Hi Yana! I found The Français Hub website and I'd like to know more about your French classes.") {
  return `https://wa.me/${site.phone}?text=${encodeURIComponent(message)}`;
}
