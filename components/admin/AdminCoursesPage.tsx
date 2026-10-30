"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { COURSE_BADGES, COURSE_CATEGORIES, defaultCatalog, isHighlighted, type Catalog, type Course } from "@/lib/courseCatalogData";
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
  // "" = not highlighted, "keep" = leave the running highlight as it is,
  // otherwise a number of days from now.
  highlight: string;
  highlightUntil: string; // the course's current end time, used by "keep"
  whatYouLearn: string;
  includes: string;
};

const HIGHLIGHT_DAYS = [1, 3, 7, 14, 30, 60, 90];

const formatHighlightEnd = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

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
    highlight: isHighlighted(c, Date.now()) ? "keep" : "",
    highlightUntil: c.highlightUntil ?? "",
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
  highlight: "",
  highlightUntil: "",
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
    highlightUntil:
      d.highlight === "keep"
        ? d.highlightUntil || undefined
        : d.highlight
          ? new Date(Date.now() + Number(d.highlight) * 86_400_000).toISOString()
          : undefined,
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

async function saveCatalog(catalog: Catalog): Promise<{ ok: true; catalog: Catalog } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catalog),
    });
    if (!res.ok) return { ok: false, error: (await res.text()) || "Couldn't save." };
    return { ok: true, catalog: (await res.json()) as Catalog };
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
      // "delf-" / "orientation-" ids are reserved for the fixed DELF and
      // Orientation Test products (the server rejects them), so a title like
      // "DELF B1 Preparation" gets a "course-" prefix — a numeric suffix alone
      // could never get it out of the reserved range.
      let base = slugify(draft.title) || "course";
      if (/^(delf|orientation)-/.test(base)) base = `course-${base}`;
      let id = base;
      for (let n = 2; existingIds.includes(id); n++) id = `${base}-${n}`;
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
            <option value="none">No EMI (full payment only)</option>
          </select>,
        )}
        {field(
          "Highlight on top of the Courses page",
          <select value={d.highlight} onChange={set("highlight")}>
            <option value="">Not highlighted</option>
            {initial.highlight === "keep" && <option value="keep">Keep current (until {formatHighlightEnd(d.highlightUntil)})</option>}
            {HIGHLIGHT_DAYS.map((n) => (
              <option key={n} value={String(n)}>
                For {n} {n === 1 ? "day" : "days"} from now
              </option>
            ))}
          </select>,
        )}
        {field("Short description (card)", <textarea rows={2} value={d.description} onChange={set("description")} maxLength={500} />, true)}
        {field("Overview (details popup)", <textarea rows={4} value={d.overview} onChange={set("overview")} maxLength={2000} />, true)}
        {field("What you learn (one per line)", <textarea rows={5} value={d.whatYouLearn} onChange={set("whatYouLearn")} />)}
        {field("What's included (one per line)", <textarea rows={5} value={d.includes} onChange={set("includes")} />)}
      </div>

      <p className={courseStyles.hint}>
        Changes apply to the website and to new enrollments straight away. A highlighted course shows first on the Courses page, with a
        &ldquo;Featured&rdquo; tag, until its time runs out. If you change the price, this course&rsquo;s EMI plan is
        scaled to the new fee (check it in EMI Plans). Students who already enrolled keep what they agreed to pay.
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

type PriceState = {
  delf: { level: string; options: { kind: string; label: string; rupees: string; sessions: string }[] }[];
  orientation: { level: string; rupees: string }[];
};

function toPriceState(c: Catalog): PriceState {
  return {
    delf: c.delf.map((d) => ({
      level: d.level,
      options: d.options.map((o) => ({ kind: o.kind, label: o.label, rupees: String(o.priceInPaise / 100), sessions: String(o.sessions) })),
    })),
    orientation: c.orientation.map((o) => ({ level: o.level, rupees: String(o.priceInPaise / 100) })),
  };
}

// DELF preparation and Orientation Test prices — a fixed lineup, so only the
// price (and DELF's number of sessions) can change.
function FixedPrices({ catalog, onSave }: { catalog: Catalog; onSave: (next: Catalog) => Promise<string | null> }) {
  const [state, setState] = useState<PriceState>(() => toPriceState(catalog));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const setDelf = (di: number, oi: number, patch: { rupees?: string; sessions?: string }) =>
    setState((s) => ({
      ...s,
      delf: s.delf.map((d, i) => (i !== di ? d : { ...d, options: d.options.map((o, j) => (j !== oi ? o : { ...o, ...patch })) })),
    }));

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    const problem = await onSave({
      ...catalog,
      delf: catalog.delf.map((d, di) => ({
        ...d,
        options: d.options.map((o, oi) => ({
          ...o,
          priceInPaise: paise(state.delf[di].options[oi].rupees) as number,
          sessions: Number(state.delf[di].options[oi].sessions),
        })),
      })),
      orientation: catalog.orientation.map((o, i) => ({ ...o, priceInPaise: paise(state.orientation[i].rupees) as number })),
    });
    setSaving(false);
    if (problem) setError(problem);
    else setMessage("Saved — the website is updated.");
  };

  return (
    <div className={courseStyles.editor}>
      <h3 className={courseStyles.title}>DELF preparation prices</h3>
      <div style={{ overflowX: "auto" }}>
        <table className={leadStyles.table}>
          <thead>
            <tr>
              <th>Level</th>
              {state.delf[0]?.options.map((o) => (
                <th key={o.kind}>{o.label} (₹ · sessions)</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.delf.map((d, di) => (
              <tr key={d.level}>
                <td>DELF {d.level}</td>
                {d.options.map((o, oi) => (
                  <td key={o.kind}>
                    <div className={courseStyles.pair}>
                      <input type="number" min="1" aria-label={`DELF ${d.level} ${o.label} price`} value={o.rupees} onChange={(e) => setDelf(di, oi, { rupees: e.target.value })} />
                      <input type="number" min="1" aria-label={`DELF ${d.level} ${o.label} sessions`} value={o.sessions} onChange={(e) => setDelf(di, oi, { sessions: e.target.value })} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={courseStyles.title}>Orientation Test prices</h3>
      <div className={courseStyles.pair}>
        {state.orientation.map((o, i) => (
          <label key={o.level} className={courseStyles.field}>
            <span>{o.level} (₹)</span>
            <input
              type="number"
              min="1"
              value={o.rupees}
              onChange={(e) => setState((s) => ({ ...s, orientation: s.orientation.map((x, j) => (j !== i ? x : { ...x, rupees: e.target.value })) }))}
            />
          </label>
        ))}
      </div>

      {error && <p className={courseStyles.error}>{error}</p>}
      <div className={courseStyles.actions}>
        <button type="button" className={leadStyles.action} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save prices"}
        </button>
        {message && <span className={courseStyles.hint}>{message}</span>}
      </div>
    </div>
  );
}

// Admin → Courses: the list shown on the website's Courses page. Add, edit,
// reorder and delete; every change saves the whole list.
export function AdminCoursesPage() {
  const [catalog, setCatalog] = useState<Catalog>(defaultCatalog);
  const { courses } = catalog;
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // course id, or "new"
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/courses", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setCatalog(await res.json());
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
  const commit = async (next: Catalog): Promise<string | null> => {
    const result = await saveCatalog(next);
    if (!result.ok) return result.error;
    setCatalog(result.catalog);
    setEditing(null);
    setNotice("Saved — the website is updated.");
    return null;
  };

  const move = async (index: number, by: -1 | 1) => {
    const next = [...courses];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    const problem = await commit({ ...catalog, courses: next });
    if (problem) setNotice(problem);
  };

  const remove = async (course: Course) => {
    if (!window.confirm(`Delete "${course.title}" from the website? New students won't be able to enroll in it.`)) return;
    const problem = await commit({ ...catalog, courses: courses.filter((c) => c.id !== course.id) });
    if (problem) setNotice(problem);
  };

  return (
    <AdminShell>
      <div className={styles.head}>
        <small>ADMIN</small>
        <h1>Courses.</h1>
        <p>
          The courses and prices on the website&rsquo;s Courses page — add, edit or delete courses, and change DELF and Orientation Test
          prices below. When a price changes, its EMI plan is adjusted to the new fee.
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
                onSave={(course) => commit({ ...catalog, courses: [...courses, course] })}
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
                          {course.highlightUntil && isHighlighted(course, Date.now()) && (
                            <div className={leadStyles.muted}>★ Highlighted until {formatHighlightEnd(course.highlightUntil)}</div>
                          )}
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
                              onSave={(updated) => commit({ ...catalog, courses: courses.map((c) => (c.id === course.id ? updated : c)) })}
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

            <FixedPrices catalog={catalog} onSave={commit} />
          </>
        )}
      </div>
    </AdminShell>
  );
}
