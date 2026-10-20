"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { COURSE_BADGES, COURSE_CATEGORIES, type Course } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";
import { AdminShell } from "../AdminShell";
import styles from "./AdminLessonsManager.module.css";
import leadStyles from "./AdminLeadsPanel.module.css";
import courseStyles from "./AdminCoursesPage.module.css";

type Draft = {
  id: string;
  title: string;
  category: string;
  badge: string;
  level: string;
  minimumLevel: string;
  target: string;
  description: string;
  overview: string;
  duration: string;
  maxDuration: string;
  classes: string;
  mode: string;
  rupees: string;
  regularRupees: string;
  savingsRupees: string;
  emi: string;
  whatYouLearn: string;
  includes: string;
};

const toRupees = (paise?: number) => (paise ? String(paise / 100) : "");

function toDraft(c: Course): Draft {
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    badge: c.badge ?? "",
    level: c.level ?? "",
    minimumLevel: c.minimumLevel ?? "",
    target: c.target ?? "",
    description: c.description,
    overview: c.overview,
    duration: c.duration,
    maxDuration: c.maxDuration ?? "",
    classes: c.classes ? String(c.classes) : "",
    mode: c.mode,
    rupees: toRupees(c.priceInPaise),
    regularRupees: toRupees(c.regularPriceInPaise),
    savingsRupees: toRupees(c.savingsInPaise),
    emi: c.emi ?? "monthly",
    whatYouLearn: c.whatYouLearn.join("\n"),
    includes: c.includes.join("\n"),
  };
}

const EMPTY: Draft = {
  id: "",
  title: "",
  category: "TEF",
  badge: "",
  level: "",
  minimumLevel: "",
  target: "",
  description: "",
  overview: "",
  duration: "",
  maxDuration: "",
  classes: "",
  mode: "Live online",
  rupees: "",
  regularRupees: "",
  savingsRupees: "",
  emi: "monthly",
  whatYouLearn: "",
  includes: "",
};

// Rupees typed by the admin → paise; undefined when blank, NaN when not a
// whole number of rupees (the server rejects it and says so).
function paise(rupees: string): number | undefined {
  const t = rupees.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

const splitLines = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);

function fromDraft(d: Draft): Course {
  return {
    id: d.id,
    title: d.title,
    category: d.category as Course["category"],
    badge: (d.badge || undefined) as Course["badge"],
    level: d.level || undefined,
    minimumLevel: d.minimumLevel || undefined,
    target: d.target || undefined,
    description: d.description,
    overview: d.overview,
    duration: d.duration,
    maxDuration: d.maxDuration || undefined,
    classes: d.classes.trim() ? Number(d.classes) : undefined,
    mode: d.mode,
    priceInPaise: paise(d.rupees) as number,
    regularPriceInPaise: paise(d.regularRupees),
    savingsInPaise: paise(d.savingsRupees),
    emi: d.emi as Course["emi"],
    whatYouLearn: splitLines(d.whatYouLearn),
    includes: splitLines(d.includes),
  };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function saveList(list: Course[]): Promise<{ ok: true; courses: Course[] } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(list),
    });
    if (!res.ok) return { ok: false, error: (await res.text()) || "Couldn't save." };
    return { ok: true, courses: (await res.json()) as Course[] };
  } catch {
    return { ok: false, error: "Couldn't save — check your connection." };
  }
}

function CourseEditor({
  initial,
  isNew,
  existingIds,
  onCancel,
  onSave,
}: {
  initial: Draft;
  isNew: boolean;
  existingIds: string[];
  onCancel: () => void;
  onSave: (course: Course) => Promise<string | null>;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setD((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async () => {
    const draft = { ...d };
    if (isNew) {
      const base = slugify(draft.title) || "course";
      let id = base;
      for (let n = 2; existingIds.includes(id) || /^(delf|orientation)-/.test(id); n++) id = `${base}-${n}`;
      draft.id = id;
    }
    setSaving(true);
    setError("");
    const problem = await onSave(fromDraft(draft));
    setSaving(false);
    if (problem) setError(problem);
  };

  const field = (label: string, input: React.ReactNode, wide = false) => (
    <label className={wide ? courseStyles.wide : courseStyles.field}>
      <span>{label}</span>
      {input}
    </label>
  );

  return (
    <div className={courseStyles.editor}>
      <div className={courseStyles.grid}>
        {field("Title", <input value={d.title} onChange={set("title")} maxLength={120} />, true)}
        {field(
          "Category (which filter it shows under)",
          <select value={d.category} onChange={set("category")}>
            {COURSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>,
        )}
        {field(
          "Badge",
          <select value={d.badge} onChange={set("badge")}>
            <option value="">None</option>
            {COURSE_BADGES.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>,
        )}
        {field("Price (₹)", <input type="number" min="1" step="1" value={d.rupees} onChange={set("rupees")} />)}
        {field("Regular price (₹, optional — shows as struck out)", <input type="number" min="0" value={d.regularRupees} onChange={set("regularRupees")} />)}
        {field("Savings (₹, optional)", <input type="number" min="0" value={d.savingsRupees} onChange={set("savingsRupees")} />)}
        {field("Duration (e.g. 20–22 classes)", <input value={d.duration} onChange={set("duration")} maxLength={60} />)}
        {field("Max duration (optional)", <input value={d.maxDuration} onChange={set("maxDuration")} maxLength={60} />)}
        {field("Number of classes (optional)", <input type="number" min="1" value={d.classes} onChange={set("classes")} />)}
        {field("Mode", <input value={d.mode} onChange={set("mode")} maxLength={60} />)}
        {field("Level (optional, e.g. CLB 5)", <input value={d.level} onChange={set("level")} maxLength={60} />)}
        {field("Minimum level (optional, e.g. B1)", <input value={d.minimumLevel} onChange={set("minimumLevel")} maxLength={60} />)}
        {field("Target (optional, e.g. Target CLB 7+)", <input value={d.target} onChange={set("target")} maxLength={60} />)}
        {field(
          "EMI scheme",
          <select value={d.emi} onChange={set("emi")}>
            <option value="monthly">3 monthly installments</option>
            <option value="twoPart">2 parts (half now, half after 12 sessions)</option>
          </select>,
        )}
        {field("Short description (card)", <textarea rows={2} value={d.description} onChange={set("description")} maxLength={500} />, true)}
        {field("Overview (details popup)", <textarea rows={4} value={d.overview} onChange={set("overview")} maxLength={2000} />, true)}
        {field("What you learn (one per line)", <textarea rows={5} value={d.whatYouLearn} onChange={set("whatYouLearn")} />)}
        {field("What's included (one per line)", <textarea rows={5} value={d.includes} onChange={set("includes")} />)}
      </div>

      <p className={courseStyles.hint}>
        Changes apply to the website and to new enrollments straight away. Students who already enrolled keep what they paid for. After
        changing a price, check this course&rsquo;s plan in EMI Plans.
      </p>
      {error && <p className={courseStyles.error}>{error}</p>}
      <div className={courseStyles.actions}>
        <button type="button" className={leadStyles.action} onClick={submit} disabled={saving}>
          {saving ? "Saving…" : isNew ? "Add course" : "Save changes"}
        </button>
        <button type="button" className={leadStyles.action} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Admin → Courses: the list shown on the website's Courses page. Add, edit,
// reorder and delete; every change saves the whole list.
export function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // course id, or "new"
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/courses", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setCourses(await res.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Saves `next`; returns an error message, or null on success.
  const commit = async (next: Course[]): Promise<string | null> => {
    const result = await saveList(next);
    if (!result.ok) return result.error;
    setCourses(result.courses);
    setEditing(null);
    setNotice("Saved — the website is updated.");
    return null;
  };

  const move = async (index: number, by: -1 | 1) => {
    const next = [...courses];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    const problem = await commit(next);
    if (problem) setNotice(problem);
  };

  const remove = async (course: Course) => {
    if (!window.confirm(`Delete "${course.title}" from the website? New students won't be able to enroll in it.`)) return;
    const problem = await commit(courses.filter((c) => c.id !== course.id));
    if (problem) setNotice(problem);
  };

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Courses.</h1>
        <p>
          The courses on the website&rsquo;s Courses page — add, edit or delete them, and change their prices and details. DELF and
          Orientation Test prices are separate and not editable here yet.
        </p>
      </div>

      <div className={styles.tabPanel}>
        {!loaded ? (
          <p className={styles.tabHint}>Loading…</p>
        ) : loadError ? (
          <p className={courseStyles.error}>Couldn&rsquo;t load the courses. Refresh to try again.</p>
        ) : (
          <>
            <div className={courseStyles.actions}>
              <button type="button" className={leadStyles.action} onClick={() => { setNotice(""); setEditing("new"); }} disabled={editing === "new"}>
                + Add course
              </button>
              {notice && <span className={courseStyles.hint}>{notice}</span>}
            </div>

            {editing === "new" && (
              <CourseEditor
                initial={EMPTY}
                isNew
                existingIds={courses.map((c) => c.id)}
                onCancel={() => setEditing(null)}
                onSave={(course) => commit([...courses, course])}
              />
            )}

            <div style={{ overflowX: "auto" }}>
              <table className={leadStyles.table}>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course, i) => (
                    <Fragment key={course.id}>
                      <tr>
                        <td>
                          <div className={courseStyles.title}>{course.title}</div>
                          <div className={leadStyles.muted}>{course.duration}</div>
                        </td>
                        <td>{course.category}</td>
                        <td>{formatRupees(course.priceInPaise)}</td>
                        <td>
                          <div className={courseStyles.actions}>
                            <button type="button" className={leadStyles.action} onClick={() => { setNotice(""); setEditing(course.id); }} disabled={editing === course.id}>
                              Edit
                            </button>
                            <button type="button" className={leadStyles.action} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                              ↑
                            </button>
                            <button type="button" className={leadStyles.action} onClick={() => move(i, 1)} disabled={i === courses.length - 1} aria-label="Move down">
                              ↓
                            </button>
                            <button type="button" className={leadStyles.action} onClick={() => remove(course)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editing === course.id && (
                        <tr>
                          <td colSpan={4}>
                            <CourseEditor
                              initial={toDraft(course)}
                              isNew={false}
                              existingIds={[]}
                              onCancel={() => setEditing(null)}
                              onSave={(updated) => commit(courses.map((c) => (c.id === course.id ? updated : c)))}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {courses.length === 0 && <p className={styles.tabHint}>No courses yet — add one.</p>}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
