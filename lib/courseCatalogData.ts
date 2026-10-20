// Static sales/pricing course catalog for the public /courses page — a
// hand-edited product list (courses, DELF options, orientation levels),
// separate from lib/courseCatalog.ts / lib/courseData.ts (which back the
// Student Hub's video-lesson catalog) and from lib/batchData.ts's
// Batch/BatchCourse (scheduled cohorts + seats, not pricing). Prices are
// stored in paise (INR * 100), matching lib/paymentData.ts's convention.

// "TEF/TCF" courses prepare for either exam and show under both filters.
export type CourseCategory = "French Levels" | "TEF" | "TCF" | "TEF/TCF" | "DELF" | "Orientation";
export type CourseBadge = "Popular" | "Fast Track" | "Exam Prep" | "CLB 7+" | "Speaking" | "Speaking + Writing" | "Intensive";

export type Course = {
  id: string;
  category: CourseCategory;
  title: string;
  badge?: CourseBadge;
  level?: string;
  minimumLevel?: string;
  description: string;
  overview: string;
  duration: string;
  maxDuration?: string;
  classes?: number;
  mode: string;
  priceInPaise: number;
  regularPriceInPaise?: number;
  savingsInPaise?: number;
  whatYouLearn: string[];
  includes: string[];
  target?: string;
  // EMI scheme (lib/emiData.ts): 3 monthly EMIs by default, or "twoPart" —
  // half before the course starts, half after 12 sessions.
  emi?: "monthly" | "twoPart";
};

export function courseInCategory(course: Course, category: CourseCategory): boolean {
  return course.category === category || (course.category === "TEF/TCF" && (category === "TEF" || category === "TCF"));
}

const SPEAKING_INCLUDES = [
  "Complete coverage of speaking tasks and topics",
  "Exam-oriented strategies and techniques",
  "High-scoring vocabulary and expressions",
  "CLB 7+ sample answers and structures",
  "Practice questions for all relevant speaking tasks",
  "Mock tests with detailed evaluation and feedback",
  "Individual attention to improve fluency, accuracy, and confidence",
];

const SPEAKING_WRITING_INCLUDES = [
  "Complete coverage of speaking and writing tasks",
  "Exam-oriented strategies and techniques",
  "High-scoring vocabulary and expressions",
  "CLB 7+ sample answers and structures",
  "Practice questions for all relevant tasks",
  "Mock tests with detailed evaluation and feedback",
  "Individual attention to improve fluency, accuracy, and writing skills",
];

type ExpressionCourseInput = {
  id: string;
  category: "TEF" | "TCF" | "TEF/TCF";
  exam: string;
  clb: "CLB 5" | "CLB 7";
  writing: boolean;
  rupees: number;
  duration: string;
  classes?: number;
};

// The TEF/TCF Speaking and Speaking + Writing preparation courses — same
// shape for every exam / CLB target, so built from one template.
function expressionCourse(c: ExpressionCourseInput): Course {
  const skills = c.writing ? "Speaking + Writing" : "Speaking";
  const tasks = c.writing ? "speaking and writing tasks" : "speaking tasks";
  return {
    id: c.id,
    category: c.category,
    title: `${c.exam} ${c.clb} ${skills} Course`,
    badge: c.writing ? "Speaking + Writing" : "Speaking",
    level: c.clb === "CLB 7" ? "CLB 7+" : "CLB 5",
    ...(c.clb === "CLB 7" ? { minimumLevel: "B1" } : {}),
    description: `Focused ${c.exam} preparation for the ${tasks}, aimed at a ${c.clb === "CLB 7" ? "CLB 7+" : "CLB 5"} score, with mock tests and detailed feedback.`,
    overview: `A targeted course covering every ${c.exam} ${tasks.replace(" tasks", "")} task, with exam-oriented strategies, high-scoring vocabulary and expressions, CLB 7+ sample answers, and mock tests evaluated in detail${c.clb === "CLB 7" ? ". Open to learners at a minimum of B1 level" : ""}.`,
    duration: c.duration,
    ...(c.classes !== undefined ? { classes: c.classes } : {}),
    mode: "Live online",
    priceInPaise: c.rupees * 100,
    whatYouLearn: c.writing ? ["Speaking", "Writing", "Strategy", "Vocabulary", "Mock tests"] : ["Speaking", "Strategy", "Vocabulary", "Mock tests"],
    includes: c.writing ? SPEAKING_WRITING_INCLUDES : SPEAKING_INCLUDES,
    target: c.clb === "CLB 7" ? "Target CLB 7+" : "Target CLB 5",
  };
}

const expressionCourses: Course[] = [
  // Speaking
  expressionCourse({ id: "tef-clb5-speaking", category: "TEF", exam: "TEF", clb: "CLB 5", writing: false, rupees: 15_000, duration: "20–22 classes" }),
  expressionCourse({ id: "tcf-clb5-speaking", category: "TCF", exam: "TCF", clb: "CLB 5", writing: false, rupees: 18_500, duration: "20–22 classes" }),
  expressionCourse({ id: "tef-tcf-clb5-speaking", category: "TEF/TCF", exam: "TEF/TCF", clb: "CLB 5", writing: false, rupees: 16_500, duration: "20–22 classes" }),
  expressionCourse({ id: "tef-clb7-speaking", category: "TEF", exam: "TEF", clb: "CLB 7", writing: false, rupees: 18_500, duration: "28 sessions", classes: 28 }),
  expressionCourse({ id: "tcf-clb7-speaking", category: "TCF", exam: "TCF", clb: "CLB 7", writing: false, rupees: 21_500, duration: "As per batch" }),
  // Speaking + Writing
  expressionCourse({ id: "tef-clb5-speaking-writing", category: "TEF", exam: "TEF", clb: "CLB 5", writing: true, rupees: 17_000, duration: "20–22 classes" }),
  expressionCourse({ id: "tcf-clb5-speaking-writing", category: "TCF", exam: "TCF", clb: "CLB 5", writing: true, rupees: 20_500, duration: "20–22 classes" }),
  expressionCourse({ id: "tef-tcf-clb5-speaking-writing", category: "TEF/TCF", exam: "TEF/TCF", clb: "CLB 5", writing: true, rupees: 18_500, duration: "20–22 classes" }),
  expressionCourse({ id: "tef-clb7-speaking-writing", category: "TEF", exam: "TEF", clb: "CLB 7", writing: true, rupees: 20_500, duration: "28 sessions", classes: 28 }),
  expressionCourse({ id: "tcf-clb7-speaking-writing", category: "TCF", exam: "TCF", clb: "CLB 7", writing: true, rupees: 23_500, duration: "As per batch" }),
];

export const courses: Course[] = [
  {
    id: "tef-clb5",
    category: "TEF",
    title: "TEF — Target CLB 5",
    badge: "Exam Prep",
    level: "CLB 5",
    minimumLevel: "B1–B2",
    description: "Structured TEF preparation aimed at a solid CLB 5 outcome, with mock tests and exam-focused strategy throughout.",
    overview: "A structured preparation track for learners targeting CLB 5 on the TEF Canada exam, covering all four modules with exam-focused strategy, regular mock testing, and continuous guidance from enrolment through test day.",
    duration: "6–7 months",
    maxDuration: "8 months",
    mode: "Live online",
    priceInPaise: 8_500_000,
    whatYouLearn: ["Listening", "Speaking", "Reading", "Writing", "Grammar", "Vocabulary", "Practice"],
    includes: [
      "Structured training for all TEF modules",
      "Exam-focused strategies",
      "Mock tests",
      "Practice materials",
      "Lifetime access to study resources",
      "Continuous guidance throughout preparation",
    ],
    target: "Target CLB 5",
  },
  {
    id: "tef-clb7",
    category: "TEF",
    title: "TEF — Target CLB 7+",
    badge: "CLB 7+",
    level: "CLB 7+",
    minimumLevel: "B2–C1",
    description: "Advanced TEF preparation for learners targeting CLB 7 or higher, with deeper strategy work and extended mock testing.",
    overview: "An advanced preparation track for learners targeting CLB 7 and above on the TEF Canada exam, building on strong B2–C1 foundations with intensive exam-focused strategy and mock testing.",
    duration: "8–9 months",
    maxDuration: "10 months",
    mode: "Live online",
    priceInPaise: 11_000_000,
    whatYouLearn: ["Listening", "Speaking", "Reading", "Writing", "Grammar", "Vocabulary", "Practice"],
    includes: [
      "Structured training for all TEF modules",
      "Exam-focused strategies",
      "Mock tests",
      "Practice materials",
      "Lifetime access to study resources",
      "Continuous guidance throughout preparation",
    ],
    target: "Target CLB 7+",
  },
  {
    id: "tcf-clb5",
    category: "TCF",
    title: "TCF — Target CLB 5",
    badge: "Exam Prep",
    level: "CLB 5",
    minimumLevel: "B1–B2",
    description: "Structured TCF preparation aimed at a solid CLB 5 outcome, with mock tests and exam-focused strategy throughout.",
    overview: "A structured preparation track for learners targeting CLB 5 on the TCF exam, covering all four modules with exam-focused strategy, regular mock testing, and continuous guidance from enrolment through test day.",
    duration: "6–7 months",
    maxDuration: "8–8.5 months",
    mode: "Live online",
    priceInPaise: 9_000_000,
    whatYouLearn: ["Listening", "Speaking", "Reading", "Writing", "Grammar", "Vocabulary", "Practice"],
    includes: [
      "Structured training for all TCF modules",
      "Exam-focused strategies",
      "Mock tests",
      "Practice materials",
      "Lifetime access to study resources",
      "Continuous guidance throughout preparation",
    ],
    target: "Target CLB 5",
  },
  {
    id: "tcf-clb7",
    category: "TCF",
    title: "TCF — Target CLB 7+",
    badge: "CLB 7+",
    level: "CLB 7+",
    minimumLevel: "B2–C1",
    description: "Advanced TCF preparation for learners targeting CLB 7 or higher, with deeper strategy work and extended mock testing.",
    overview: "An advanced preparation track for learners targeting CLB 7 and above on the TCF exam, building on strong B2–C1 foundations with intensive exam-focused strategy and mock testing.",
    duration: "9–10 months",
    maxDuration: "11 months",
    mode: "Live online",
    priceInPaise: 12_500_000,
    whatYouLearn: ["Listening", "Speaking", "Reading", "Writing", "Grammar", "Vocabulary", "Practice"],
    includes: [
      "Structured training for all TCF modules",
      "Exam-focused strategies",
      "Mock tests",
      "Practice materials",
      "Lifetime access to study resources",
      "Continuous guidance throughout preparation",
    ],
    target: "Target CLB 7+",
  },
  {
    id: "tef-tcf-clb5-to-clb7-intensive",
    category: "TEF/TCF",
    title: "TEF/TCF Intensive — CLB 5 to CLB 7+",
    badge: "Intensive",
    level: "CLB 5 → CLB 7+",
    minimumLevel: "CLB 5",
    description: "A super-intensive course for jumping from CLB 5 to CLB 7+, across all four skills, with only 2 students per batch.",
    overview: "A super-intensive programme for learners already at CLB 5 who want to reach CLB 7+ on the TEF or TCF. It covers listening, reading, writing and speaking, with extensive practice questions in class and detailed feedback on every answer — in a batch of just 2 students.",
    duration: "2–2.5 months",
    mode: "Live online · 2 students only",
    priceInPaise: 4_990_000,
    whatYouLearn: ["Listening", "Reading", "Writing", "Speaking"],
    includes: [
      "All four skills: listening, reading, writing and speaking",
      "Extensive practice questions in class",
      "Detailed feedback on every question",
      "Only 2 students per batch",
      "Pay in 2 installments",
    ],
    target: "CLB 5 → CLB 7+",
    emi: "twoPart",
  },
  ...expressionCourses,
  {
    id: "a1-french",
    category: "French Levels",
    title: "A1 French Foundation Course",
    level: "Beginner",
    description: "A strong grammar and speaking foundation for complete beginners, built around confidence and real practice.",
    overview: "Starts from zero and builds a strong grammar foundation alongside extensive speaking practice, so confidence grows alongside accuracy from the very first class.",
    duration: "50 classes",
    classes: 50,
    mode: "Live online",
    priceInPaise: 2_000_000,
    whatYouLearn: ["Listening", "Speaking", "Reading", "Writing"],
    includes: [
      "Strong grammar foundation",
      "Extensive speaking practice",
      "Confidence-building sessions",
      "Mock papers",
      "Access to study resources",
    ],
  },
  {
    id: "a2-french",
    category: "French Levels",
    title: "A2 French Course",
    level: "Elementary",
    description: "Builds on A1 with grammar strengthening and steady speaking practice toward elementary fluency.",
    overview: "Strengthens the grammar and vocabulary base built at A1, with steady speaking practice and mock papers to build toward elementary fluency and confidence.",
    duration: "50 classes",
    classes: 50,
    mode: "Live online",
    priceInPaise: 2_250_000,
    whatYouLearn: ["Listening", "Speaking", "Reading", "Writing"],
    includes: [
      "Grammar strengthening",
      "Speaking practice",
      "Mock papers",
      "Confidence-building sessions",
      "Access to study resources",
    ],
  },
  {
    id: "a1-a2-french",
    category: "French Levels",
    title: "A1 + A2 Complete French Course",
    badge: "Fast Track",
    level: "Beginner → Elementary",
    description: "Learn French from beginner A1 to elementary A2 in one structured, DELF-oriented program.",
    overview: "Learn French from beginner A1 to elementary A2 in one structured program while saving time and money. This combined program is ideal for students who want to progress faster without taking a break between levels.",
    duration: "90 classes",
    classes: 90,
    mode: "Live online · Fast-Track Program",
    priceInPaise: 3_800_000,
    regularPriceInPaise: 4_250_000,
    savingsInPaise: 450_000,
    whatYouLearn: ["Listening", "Speaking", "Reading", "Writing"],
    includes: [
      "Complete A1 + A2 syllabus",
      "DELF-oriented curriculum",
      "Notes",
      "Practice material",
      "Regular assessments",
    ],
  },
  {
    id: "b1-french",
    category: "French Levels",
    title: "B1 French Course",
    badge: "Popular",
    level: "Intermediate",
    description: "All four skills at intermediate level, with advanced grammar and regular speaking practice.",
    overview: "Develops all four skills at intermediate level with advanced grammar and regular speaking practice, building the confidence and range needed to move comfortably into upper-intermediate French.",
    duration: "50 classes",
    classes: 50,
    mode: "Live online",
    priceInPaise: 2_500_000,
    whatYouLearn: ["Listening", "Speaking", "Reading", "Writing"],
    includes: [
      "Advanced grammar",
      "Regular speaking practice",
      "Mock papers",
      "Confidence building",
      "Access to study resources",
    ],
  },
  {
    id: "b2-french",
    category: "French Levels",
    title: "B2 French Course",
    level: "Upper-Intermediate",
    description: "Intensive training across all four skills with a strong focus on speaking fluency.",
    overview: "Intensive training across all four skills at upper-intermediate level, with a strong focus on speaking fluency and advanced grammar in preparation for advanced-level French.",
    duration: "60 classes",
    classes: 60,
    mode: "Live online",
    priceInPaise: 3_300_000,
    whatYouLearn: ["Listening", "Speaking", "Reading", "Writing"],
    includes: [
      "Intensive training for all four skills",
      "Advanced grammar",
      "Strong focus on speaking fluency",
      "Mock papers",
      "Access to study resources",
    ],
  },
  {
    id: "c1-french",
    category: "French Levels",
    title: "C1 French Course",
    level: "Advanced",
    description: "Advanced language mastery with complex grammar structures and exam-level practice.",
    overview: "Advanced language mastery with complex grammar structures, speaking fluency work, and exam-level practice for learners aiming for near-native command of French.",
    duration: "60 classes",
    classes: 60,
    mode: "Live online",
    priceInPaise: 4_000_000,
    whatYouLearn: ["Listening", "Speaking", "Reading", "Writing"],
    includes: [
      "Advanced language mastery",
      "Speaking fluency",
      "Complex grammar structures",
      "Exam-level practice",
      "Mock papers",
      "Access to study resources",
    ],
  },
];

export type DelfOptionKind = "speaking" | "writing" | "speakingWriting";
export type DelfOption = { kind: DelfOptionKind; label: string; priceInPaise: number; sessions: number };
export type DelfLevel = "A1" | "A2" | "B1" | "B2" | "C1";
export type DelfCourse = { level: DelfLevel; options: DelfOption[] };

function delfOptions(
  speakingRupees: number, speakingSessions: number,
  writingRupees: number, writingSessions: number,
  bothRupees: number, bothSessions: number
): DelfOption[] {
  return [
    { kind: "speaking", label: "Speaking", priceInPaise: speakingRupees * 100, sessions: speakingSessions },
    { kind: "writing", label: "Writing", priceInPaise: writingRupees * 100, sessions: writingSessions },
    { kind: "speakingWriting", label: "Speaking + Writing", priceInPaise: bothRupees * 100, sessions: bothSessions },
  ];
}

export const delfCourses: DelfCourse[] = [
  { level: "A1", options: delfOptions(6999, 15, 6999, 15, 9999, 20) },
  { level: "A2", options: delfOptions(7999, 15, 7999, 15, 11000, 20) },
  { level: "B1", options: delfOptions(10500, 18, 9000, 15, 12000, 20) },
  { level: "B2", options: delfOptions(13500, 20, 11000, 15, 23000, 20) },
  { level: "C1", options: delfOptions(15000, 20, 13500, 20, 22500, 30) },
];

export type OrientationLevel = { level: "A1" | "A2" | "B1" | "B2"; priceInPaise: number };
export const orientationLevels: OrientationLevel[] = [
  { level: "A1", priceInPaise: 15_000 },
  { level: "A2", priceInPaise: 20_000 },
  { level: "B1", priceInPaise: 30_000 },
  { level: "B2", priceInPaise: 40_000 },
];

// Discriminated union the enroll/payment flow accepts, so one modal handles
// a plain Course, a DELF skill option, or an Orientation Test level.
export type Enrollable =
  | { kind: "course"; course: Course }
  | { kind: "delf"; level: DelfLevel; option: DelfOption }
  | { kind: "orientation"; level: OrientationLevel };

export function enrollableProductId(e: Enrollable): string {
  if (e.kind === "course") return e.course.id;
  if (e.kind === "delf") return `delf-${e.level.toLowerCase()}-${e.option.kind}`;
  return `orientation-${e.level.level.toLowerCase()}`;
}

export function enrollableTitle(e: Enrollable): string {
  if (e.kind === "course") return e.course.title;
  if (e.kind === "delf") {
    const labels: Record<DelfOptionKind, string> = {
      speaking: "Speaking Preparation",
      writing: "Writing Preparation",
      speakingWriting: "Speaking + Writing Preparation",
    };
    return `DELF ${e.level} ${labels[e.option.kind]}`;
  }
  return `French Orientation Test — ${e.level.level}`;
}

export function enrollablePriceInPaise(e: Enrollable): number {
  if (e.kind === "course") return e.course.priceInPaise;
  if (e.kind === "delf") return e.option.priceInPaise;
  return e.level.priceInPaise;
}

// Every product that can be bought on EMI (all courses and DELF options —
// not the Orientation Test), for Admin → EMI Plans.
export type EmiProduct = { productId: string; title: string; group: string; enrollable: Enrollable };
export function emiProducts(courseList: Course[] = courses): EmiProduct[] {
  const list: Enrollable[] = [
    ...courseList.map((course): Enrollable => ({ kind: "course", course })),
    ...delfCourses.flatMap((d) => d.options.map((option): Enrollable => ({ kind: "delf", level: d.level, option }))),
  ];
  return list.map((enrollable) => ({
    productId: enrollableProductId(enrollable),
    title: enrollableTitle(enrollable),
    group: enrollable.kind === "course" ? enrollable.course.category : "DELF",
    enrollable,
  }));
}

// Server-side price lookup by productId, used by
// app/api/course-payment/create-order so the charged amount is always
// re-derived here — never trusted from the client. Mirrors
// enrollableProductId's id shapes exactly.
export function findEnrollableByProductId(productId: string, courseList: Course[] = courses): Enrollable | null {
  const course = courseList.find((c) => c.id === productId);
  if (course) return { kind: "course", course };

  const delfMatch = productId.match(/^delf-([a-z0-9]+)-(speaking|writing|speakingWriting)$/i);
  if (delfMatch) {
    const level = delfMatch[1].toUpperCase() as DelfLevel;
    const kind = delfMatch[2] as DelfOptionKind;
    const delfCourse = delfCourses.find((d) => d.level === level);
    const option = delfCourse?.options.find((o) => o.kind === kind);
    if (delfCourse && option) return { kind: "delf", level, option };
  }

  const orientationMatch = productId.match(/^orientation-([a-z0-9]+)$/i);
  if (orientationMatch) {
    const level = orientationMatch[1].toUpperCase();
    const found = orientationLevels.find((o) => o.level === level);
    if (found) return { kind: "orientation", level: found };
  }

  return null;
}

// The `courses` above are the defaults; Admin → Courses saves an edited
// list (lib/courseCatalogServer.ts) that replaces them. This validates a
// list coming from the admin API or storage — never trusted as-is, since
// prices and ids drive checkout.
export const COURSE_CATEGORIES: CourseCategory[] = ["French Levels", "TEF", "TCF", "TEF/TCF", "DELF", "Orientation"];
export const COURSE_BADGES: CourseBadge[] = ["Popular", "Fast Track", "Exam Prep", "CLB 7+", "Speaking", "Speaking + Writing", "Intensive"];
export const COURSE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,59}$/;
const MAX_PRICE_PAISE = 100_000_000; // Rs 10,00,000

// Trimmed text, undefined when optional and empty, null when invalid.
function text(v: unknown, max: number, required: boolean): string | undefined | null {
  if (v === undefined || v === null || v === "") return required ? null : undefined;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return required ? null : undefined;
  return t.length > max ? null : t;
}

function lines(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > 30) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return null;
    const t = item.trim();
    if (t.length > 200) return null;
    if (t) out.push(t);
  }
  return out;
}

function paise(v: unknown): number | undefined | null {
  if (v === undefined || v === null) return undefined;
  return Number.isInteger(v) && (v as number) > 0 && (v as number) <= MAX_PRICE_PAISE ? (v as number) : null;
}

export function sanitizeCourses(raw: unknown): { courses: Course[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length > 100) return { error: "Invalid course list." };
  const seen = new Set<string>();
  const out: Course[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") return { error: "Invalid course." };
    const id = typeof r.id === "string" ? r.id : "";
    if (!COURSE_ID_PATTERN.test(id) || /^(delf|orientation)-/.test(id)) return { error: `Invalid course id "${id}".` };
    if (seen.has(id)) return { error: `Duplicate course id "${id}".` };
    seen.add(id);

    const title = text(r.title, 120, true);
    if (!title) return { error: `"${id}": enter a title (up to 120 characters).` };
    if (!COURSE_CATEGORIES.includes(r.category as CourseCategory)) return { error: `"${title}": choose a category.` };
    if (r.badge !== undefined && r.badge !== null && r.badge !== "" && !COURSE_BADGES.includes(r.badge as CourseBadge)) {
      return { error: `"${title}": invalid badge.` };
    }
    const description = text(r.description, 500, true);
    const overview = text(r.overview, 2000, true);
    const duration = text(r.duration, 60, true);
    const mode = text(r.mode, 60, true);
    if (!description || !overview || !duration || !mode) {
      return { error: `"${title}": description, overview, duration and mode are required (check the lengths).` };
    }
    const level = text(r.level, 60, false);
    const minimumLevel = text(r.minimumLevel, 60, false);
    const maxDuration = text(r.maxDuration, 60, false);
    const target = text(r.target, 60, false);
    if (level === null || minimumLevel === null || maxDuration === null || target === null) {
      return { error: `"${title}": a text field is too long.` };
    }

    const priceInPaise = paise(r.priceInPaise);
    const regularPriceInPaise = paise(r.regularPriceInPaise);
    const savingsInPaise = paise(r.savingsInPaise);
    if (!priceInPaise || regularPriceInPaise === null || savingsInPaise === null) return { error: `"${title}": enter a valid price.` };
    const classes = r.classes === undefined || r.classes === null ? undefined : Number(r.classes);
    if (classes !== undefined && (!Number.isInteger(classes) || classes < 1 || classes > 500)) {
      return { error: `"${title}": invalid number of classes.` };
    }
    const whatYouLearn = lines(r.whatYouLearn);
    const includes = lines(r.includes);
    if (!whatYouLearn || !includes) return { error: `"${title}": invalid "what you learn" / "includes" list.` };
    if (r.emi !== undefined && r.emi !== null && r.emi !== "monthly" && r.emi !== "twoPart") {
      return { error: `"${title}": invalid EMI scheme.` };
    }

    out.push({
      id,
      category: r.category as CourseCategory,
      title,
      ...(r.badge ? { badge: r.badge as CourseBadge } : {}),
      ...(level ? { level } : {}),
      ...(minimumLevel ? { minimumLevel } : {}),
      description,
      overview,
      duration,
      ...(maxDuration ? { maxDuration } : {}),
      ...(classes !== undefined ? { classes } : {}),
      mode,
      priceInPaise,
      ...(regularPriceInPaise ? { regularPriceInPaise } : {}),
      ...(savingsInPaise ? { savingsInPaise } : {}),
      whatYouLearn,
      includes,
      ...(target ? { target } : {}),
      ...(r.emi ? { emi: r.emi as "monthly" | "twoPart" } : {}),
    });
  }
  return { courses: out };
}
