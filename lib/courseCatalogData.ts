// Static sales/pricing course catalog for the public /courses page — a
// hand-edited product list (courses, DELF options, orientation levels),
// separate from lib/courseCatalog.ts / lib/courseData.ts (which back the
// Student Hub's video-lesson catalog) and from lib/batchData.ts's
// Batch/BatchCourse (scheduled cohorts + seats, not pricing). Prices are
// stored in paise (INR * 100), matching lib/paymentData.ts's convention.

export type CourseCategory = "French Levels" | "TEF" | "TCF" | "DELF" | "Orientation";
export type CourseBadge = "Popular" | "Fast Track" | "Exam Prep" | "CLB 7+";

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
};

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

// Server-side price lookup by productId, used by
// app/api/course-payment/create-order so the charged amount is always
// re-derived here — never trusted from the client. Mirrors
// enrollableProductId's id shapes exactly.
export function findEnrollableByProductId(productId: string): Enrollable | null {
  const course = courses.find((c) => c.id === productId);
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
