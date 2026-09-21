// Simple on/off switches for temporarily changing site behavior without
// deleting the underlying feature. Flip back to restore the original
// behavior exactly as it was — no other code changes needed.

// The public /resources catalog's PDF/notes listings are currently
// outdated. While true, app/resources/page.tsx and
// app/resources/[slug]/page.tsx show a "Coming Soon" state instead of the
// real catalog (see components/ResourcesComingSoon.tsx) — the catalog
// data, ResourceCatalog component, and detail pages are untouched and
// come straight back once this is set to false.
export const RESOURCES_COMING_SOON = true;
