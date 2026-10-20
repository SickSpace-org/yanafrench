// Server-only. The public course list as Admin → Courses last saved it —
// one JSON document in R2 next to the EMI settings (lib/emiSettingsServer.ts).
// Until the admin saves for the first time (or if the document is missing or
// invalid) the defaults in lib/courseCatalogData.ts are used.

import { readJson, writeJson } from "./r2";
import { courses as defaultCourses, findEnrollableByProductId, sanitizeCourses, type Course, type Enrollable } from "./courseCatalogData";

export const COURSES_KEY = "data/courses.json";

export async function readCourses(): Promise<Course[]> {
  const raw = await readJson<unknown>(COURSES_KEY, null);
  if (raw === null) return defaultCourses;
  const parsed = sanitizeCourses(raw);
  return "courses" in parsed ? parsed.courses : defaultCourses;
}

export function writeCourses(list: Course[]): Promise<boolean> {
  return writeJson(COURSES_KEY, list);
}

// Server-side lookup against the live list — what checkout, EMI and the
// student's "my course" all price from.
export async function findEnrollable(productId: string): Promise<Enrollable | null> {
  return findEnrollableByProductId(productId, await readCourses());
}
