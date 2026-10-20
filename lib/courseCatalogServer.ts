// Server-only. The public catalog (courses, DELF and Orientation Test
// prices) as Admin → Courses last saved it — one JSON document in R2 next to
// the EMI settings (lib/emiSettingsServer.ts). Until the admin saves for the
// first time (or if the document is missing or invalid) the defaults in
// lib/courseCatalogData.ts are used.

import { readJson, writeJson } from "./r2";
import { defaultCatalog, emiProducts, enrollablePriceInPaise, findEnrollableByProductId, sanitizeCatalog, type Catalog, type Enrollable } from "./courseCatalogData";
import { rescaleEmiSetting } from "./emiData";
import { EMI_SETTINGS_KEY, readEmiSettings } from "./emiSettingsServer";

export const CATALOG_KEY = "data/catalog.json";

export async function readCatalog(): Promise<Catalog> {
  const raw = await readJson<unknown>(CATALOG_KEY, null);
  if (raw === null) return defaultCatalog;
  const parsed = sanitizeCatalog(raw);
  return "catalog" in parsed ? parsed.catalog : defaultCatalog;
}

// Saves the catalog and carries each changed-price product's custom EMI plan
// over to its new fee (a plan that can't be scaled is dropped, so the default
// plan applies). Existing students' schedules aren't touched.
export async function writeCatalog(next: Catalog): Promise<boolean> {
  const prev = await readCatalog();
  if (!(await writeJson(CATALOG_KEY, next))) return false;

  const settings = await readEmiSettings();
  const oldPrices = new Map(emiProducts(prev).map((p) => [p.productId, enrollablePriceInPaise(p.enrollable)]));
  let changed = false;
  for (const product of emiProducts(next)) {
    const setting = settings[product.productId];
    const oldPrice = oldPrices.get(product.productId);
    const newPrice = enrollablePriceInPaise(product.enrollable);
    if (!setting || oldPrice === undefined || oldPrice === newPrice) continue;
    const rescaled = rescaleEmiSetting(setting, Math.round(oldPrice / 100), Math.round(newPrice / 100));
    if (rescaled) settings[product.productId] = rescaled;
    else delete settings[product.productId];
    changed = true;
  }
  if (changed) await writeJson(EMI_SETTINGS_KEY, settings);
  return true;
}

// Server-side lookup against the live catalog — what checkout, EMI and the
// student's "my course" all price from.
export async function findEnrollable(productId: string): Promise<Enrollable | null> {
  return findEnrollableByProductId(productId, await readCatalog());
}
