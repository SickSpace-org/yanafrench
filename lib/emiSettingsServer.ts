// Server-only. Admin → EMI Plans' per-product EMI settings, kept as one
// JSON document in R2 next to the portal state (lib/portalStateServer.ts)
// — small, rarely written, and needs no database migration. See
// lib/emiData.ts for the plan rules and the defaults used when a product
// has no setting.

import { readJson, writeJson } from "./r2";
import { enrollablePriceInPaise, type Enrollable } from "./courseCatalogData";
import { findEnrollable } from "./courseCatalogServer";
import { resolveEmiPlan, type EmiPlan, type EmiSetting, type EmiSettings } from "./emiData";

export const EMI_SETTINGS_KEY = "data/emi-settings.json";

export async function readEmiSettings(): Promise<EmiSettings> {
  const raw = await readJson<EmiSettings>(EMI_SETTINGS_KEY, {});
  return raw && typeof raw === "object" ? raw : {};
}

// Sets (or, with null, clears back to the default) one product's setting.
export async function writeEmiSetting(productId: string, setting: EmiSetting | null): Promise<boolean> {
  const settings = await readEmiSettings();
  if (setting) settings[productId] = setting;
  else delete settings[productId];
  return writeJson(EMI_SETTINGS_KEY, settings);
}

// A product, its fee and the EMI plan it's sold on right now (plan null =
// pay in full only) — what checkout, fulfillment and the admin's
// Enrollments page all charge and schedule from.
export async function productEmiPlan(
  productId: string,
  settings?: EmiSettings
): Promise<{ enrollable: Enrollable; pricePaise: number; plan: EmiPlan | null } | null> {
  const enrollable = await findEnrollable(productId);
  if (!enrollable) return null;
  const pricePaise = enrollablePriceInPaise(enrollable);
  const all = settings ?? (await readEmiSettings());
  return { enrollable, pricePaise, plan: resolveEmiPlan(enrollable, pricePaise, all[productId]) };
}
