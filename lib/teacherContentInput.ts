// Input checks shared by the teacher content routes.

import { cleanClassLink } from "./classLinks";

export function cleanTitle(input: unknown, max = 200): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim().replace(/\s+/g, " ");
  return t && t.length <= max ? t : null;
}

export function cleanDate(input: unknown): string | null | undefined {
  if (input === null || input === undefined || input === "") return null;
  return typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input) && !Number.isNaN(Date.parse(input)) ? input : undefined;
}

// http(s) links only — same rule as class links.
export function cleanRecordingUrl(input: unknown): string | null {
  return cleanClassLink(input);
}
