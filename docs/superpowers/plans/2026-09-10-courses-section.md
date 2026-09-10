# Courses Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium, filterable Courses catalog at `/courses` — browse → view details → enroll → pay via Razorpay — fully isolated from the existing batch-seat enrollment system.

**Architecture:** A static, hand-edited course catalog (`lib/courseCatalogData.ts`) drives a filterable card grid + DELF pricing matrix + Orientation Test card. Enrolling opens a modal that captures contact details, persists a lead, then opens a Razorpay checkout for the real course fee (server re-derives the price from the catalog — never trusts the client). New, isolated Supabase tables (`course_leads`, `course_payments`) and API routes mirror the existing batch-payment pattern exactly (same HMAC verification) without touching it.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, CSS Modules + `app/globals.css` design tokens, `motion/react`, Supabase (service-role client via `lib/supabaseAdmin.ts`), Razorpay REST API (test-mode key already configured).

**Spec:** `docs/superpowers/specs/2026-09-10-courses-section-design.md`

## Global Constraints

- Real course fee amounts are charged (not a flat placeholder) — Razorpay is on a test key (`rzp_test_…`), so no real money moves; see spec §2.
- No changes to `components/BatchFinder.tsx`, `components/EnrollModal.tsx`, `app/api/payment/*`, or the `Batch`/`BatchCourse`/`Lead`/`Payment`/`Student` types.
- No new admin UI in this pass — new tables are visible via the Supabase dashboard only.
- No changes to `/tef-tcf`, `/delf`, `/find-your-batch`.
- All new prices stored/transmitted in **paise** (INR × 100), matching the existing `Payment.amount` convention.
- No secrets in client code — `RAZORPAY_KEY_SECRET` stays server-only; only `NEXT_PUBLIC_RAZORPAY_KEY_ID` is read client-side.
- Reuse existing design tokens/classes/components (`app/globals.css`, `PageHero`, `Reveal`, `Arrow`, `WhatsAppLink`, `.button` variants, `.eyebrow`) — no new design system.
- Exactly one B2 French Course entry (the spec's duplicate is intentionally collapsed).
- No horizontal overflow on mobile (≤480px), especially the DELF matrix.
- No new npm dependencies — this project has no test runner configured; verification steps use `npx tsc --noEmit`, `curl` against the dev server, and manual browser checks instead of a unit-test framework, matching the codebase's existing (test-free) convention.

---

### Task 1: Course catalog data model + currency formatter

**Files:**
- Create: `lib/courseCatalogData.ts`
- Create: `lib/formatCurrency.ts`

**Interfaces:**
- Produces: `Course`, `CourseCategory`, `CourseBadge`, `courses: Course[]`, `DelfOptionKind`, `DelfOption`, `DelfLevel`, `DelfCourse`, `delfCourses: DelfCourse[]`, `OrientationLevel`, `orientationLevels: OrientationLevel[]`, `Enrollable`, `enrollableProductId(e: Enrollable): string`, `enrollableTitle(e: Enrollable): string`, `enrollablePriceInPaise(e: Enrollable): number`, `findEnrollableByProductId(id: string): Enrollable | null` — all from `lib/courseCatalogData.ts`.
- Produces: `formatRupees(paise: number): string` from `lib/formatCurrency.ts`.

- [ ] **Step 1: Write `lib/courseCatalogData.ts`**

```ts
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
  { level: "B2", options: delfOptions(13500, 20, 11000, 15, 13000, 20) },
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
```

- [ ] **Step 2: Write `lib/formatCurrency.ts`**

```ts
// Shared INR currency formatting — Indian digit grouping (lakhs/crores),
// no decimal places, from a paise integer. Used by the course catalog and
// its enroll/payment flow; components/admin/AdminPaymentsPanel.tsx has its
// own simpler formatter for the (2-decimal, non-grouped) batch payment
// amounts and is left as-is.
export function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify catalog counts**

Open `lib/courseCatalogData.ts` and confirm: exactly 10 entries in `courses` (2 TEF, 2 TCF, 6 French Levels: A1, A2, A1+A2, B1, B2, C1 — **only one** B2 entry), 5 entries in `delfCourses` each with 3 `options`, 4 entries in `orientationLevels`. Spot-check `enrollableTitle({ kind: "delf", level: "B2", option: delfCourses[3].options[0] })` mentally resolves to `"DELF B2 Speaking Preparation"` and its price is `1_350_000` paise (₹13,500).

- [ ] **Step 5: Commit**

```bash
git add lib/courseCatalogData.ts lib/formatCurrency.ts
git commit -m "feat: add course catalog data model and INR formatter"
```

---

### Task 2: Isolated Supabase tables for course leads/payments

**Files:**
- Create: `supabase/migrations/20260910120000_create_course_leads_payments.sql`
- Create: `lib/courseLeadData.ts`
- Create: `lib/coursePaymentData.ts`

**Interfaces:**
- Consumes: none.
- Produces: `CURRENT_LEVELS`, `CurrentLevel`, `LEARNING_MODES`, `LearningMode`, `CourseLead`, `CourseLeadRow`, `courseLeadFromRow`, `courseLeadToRow` from `lib/courseLeadData.ts`. `CoursePaymentStatus`, `CoursePayment`, `CoursePaymentRow`, `coursePaymentFromRow`, `coursePaymentToRow` from `lib/coursePaymentData.ts`. Tables `public.course_leads`, `public.course_payments` in Supabase.

- [ ] **Step 1: Write the migration**

```sql
-- Enrollment pipeline tables for the public /courses catalog (course
-- packages, DELF skill options, orientation test levels) — isolated from
-- public.leads/payments/students, which back the batch-seat enrollment
-- system (see 20260907120000_create_leads_payments_students.sql). Matches
-- the row shapes in lib/courseLeadData.ts and lib/coursePaymentData.ts.
-- Same access model as that migration: RLS enabled with no policies, so
-- only the service-role key (lib/supabaseAdmin.ts) can reach these tables.

create table if not exists public.course_leads (
  id text primary key,
  name text not null,
  phone text not null,
  email text not null,
  whatsapp text,
  product_id text not null,
  product_title text not null,
  current_level text,
  preferred_mode text,
  message text,
  payment_status text,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);

create index if not exists course_leads_created_at_idx on public.course_leads using btree (created_at desc);

alter table public.course_leads enable row level security;

create table if not exists public.course_payments (
  id text primary key, -- Razorpay order id
  lead_id text not null,
  name text not null,
  email text not null,
  phone text not null,
  product_id text not null,
  product_title text not null,
  amount integer not null, -- paise
  currency text not null,
  status text not null,
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists course_payments_created_at_idx on public.course_payments using btree (created_at desc);

alter table public.course_payments enable row level security;

grant select, insert, update, delete on public.course_leads, public.course_payments
  to anon, authenticated;
```

- [ ] **Step 2: Apply the migration to the linked Supabase project**

Use the `supabase` skill to apply this migration to the project referenced by `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (check how `20260907120000_create_leads_payments_students.sql` was applied — likely the Supabase SQL editor or `supabase db push` — and follow the same route). Confirm afterward that `public.course_leads` and `public.course_payments` exist with the columns above.

- [ ] **Step 3: Write `lib/courseLeadData.ts`**

```ts
// An enrollment inquiry captured from the public /courses page, before
// payment opens — mirrors lib/leadData.ts's shape and Supabase persistence
// pattern, but kept fully separate: courses/DELF options/orientation
// levels aren't scheduled batches, so this doesn't reuse Lead/BatchCourse.
// See app/api/course-leads/route.ts and
// supabase/migrations/20260910120000_create_course_leads_payments.sql.

export const CURRENT_LEVELS = ["New to French", "A1", "A2", "B1", "B2", "C1"] as const;
export type CurrentLevel = (typeof CURRENT_LEVELS)[number];

export const LEARNING_MODES = ["Live online", "No preference"] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];

export type CourseLead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  whatsapp?: string | null;
  productId: string;
  productTitle: string;
  currentLevel?: CurrentLevel | null;
  preferredMode?: LearningMode | null;
  message?: string | null;
  createdAt: string;
  paymentStatus?: "paid" | "pending" | "failed" | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
};

export type CourseLeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  whatsapp: string | null;
  product_id: string;
  product_title: string;
  current_level: string | null;
  preferred_mode: string | null;
  message: string | null;
  created_at: string;
  payment_status: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
};

export function courseLeadFromRow(row: CourseLeadRow): CourseLead {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    whatsapp: row.whatsapp,
    productId: row.product_id,
    productTitle: row.product_title,
    currentLevel: (row.current_level as CurrentLevel | null) ?? null,
    preferredMode: (row.preferred_mode as LearningMode | null) ?? null,
    message: row.message,
    createdAt: row.created_at,
    paymentStatus: (row.payment_status as CourseLead["paymentStatus"]) ?? null,
    razorpayOrderId: row.razorpay_order_id,
    razorpayPaymentId: row.razorpay_payment_id,
  };
}

export function courseLeadToRow(lead: CourseLead): CourseLeadRow {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    whatsapp: lead.whatsapp ?? null,
    product_id: lead.productId,
    product_title: lead.productTitle,
    current_level: lead.currentLevel ?? null,
    preferred_mode: lead.preferredMode ?? null,
    message: lead.message ?? null,
    created_at: lead.createdAt,
    payment_status: lead.paymentStatus ?? null,
    razorpay_order_id: lead.razorpayOrderId ?? null,
    razorpay_payment_id: lead.razorpayPaymentId ?? null,
  };
}
```

- [ ] **Step 4: Write `lib/coursePaymentData.ts`**

```ts
// A payment transaction ledger for course-catalog enrollments — one record
// per Razorpay order created from app/api/course-payment/create-order,
// independent of the CourseLead it came from. Mirrors lib/paymentData.ts's
// shape but is kept fully separate from the batch system's Payment type.

export type CoursePaymentStatus = "created" | "paid" | "failed";

export type CoursePayment = {
  id: string; // Razorpay order id
  leadId: string;
  name: string;
  email: string;
  phone: string;
  productId: string;
  productTitle: string;
  amount: number; // paise
  currency: string;
  status: CoursePaymentStatus;
  razorpayPaymentId?: string | null;
  createdAt: string;
  paidAt?: string | null;
};

export type CoursePaymentRow = {
  id: string;
  lead_id: string;
  name: string;
  email: string;
  phone: string;
  product_id: string;
  product_title: string;
  amount: number;
  currency: string;
  status: CoursePaymentStatus;
  razorpay_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export function coursePaymentFromRow(row: CoursePaymentRow): CoursePayment {
  return {
    id: row.id,
    leadId: row.lead_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    productId: row.product_id,
    productTitle: row.product_title,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    razorpayPaymentId: row.razorpay_payment_id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export function coursePaymentToRow(payment: CoursePayment): CoursePaymentRow {
  return {
    id: payment.id,
    lead_id: payment.leadId,
    name: payment.name,
    email: payment.email,
    phone: payment.phone,
    product_id: payment.productId,
    product_title: payment.productTitle,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    razorpay_payment_id: payment.razorpayPaymentId ?? null,
    created_at: payment.createdAt,
    paid_at: payment.paidAt ?? null,
  };
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260910120000_create_course_leads_payments.sql lib/courseLeadData.ts lib/coursePaymentData.ts
git commit -m "feat: add isolated course_leads/course_payments Supabase tables"
```

---

### Task 3: `/api/course-leads` route

**Files:**
- Create: `app/api/course-leads/route.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` from `lib/supabaseAdmin.ts`; `CourseLead`, `courseLeadToRow` from `lib/courseLeadData.ts` (Task 2).
- Produces: `POST /api/course-leads` — body `{ name, phone, email, whatsapp?, productId, productTitle, currentLevel?, preferredMode?, message? }` → `{ leadId: string }` (201-equivalent 200) or 400/501/502.

- [ ] **Step 1: Write the route**

```ts
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { courseLeadToRow, type CourseLead } from "@/lib/courseLeadData";

type CreateLeadBody = {
  name?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  productId?: string;
  productTitle?: string;
  currentLevel?: string;
  preferredMode?: string;
  message?: string;
};

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new Response("Supabase isn't configured.", { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateLeadBody;
  const { name, phone, email, whatsapp, productId, productTitle, currentLevel, preferredMode, message } = body;

  if (!name?.trim() || !phone?.trim() || !email?.trim() || !productId || !productTitle) {
    return new Response("Missing required fields.", { status: 400 });
  }

  const lead: CourseLead = {
    id: `course-lead-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
    whatsapp: whatsapp?.trim() || null,
    productId,
    productTitle,
    currentLevel: (currentLevel as CourseLead["currentLevel"]) || null,
    preferredMode: (preferredMode as CourseLead["preferredMode"]) || null,
    message: message?.trim() || null,
    createdAt: new Date().toISOString(),
    paymentStatus: null,
    razorpayOrderId: null,
    razorpayPaymentId: null,
  };

  const { error } = await supabase.from("course_leads").insert(courseLeadToRow(lead));
  if (error) {
    console.error("Failed to record course lead", error);
    return new Response("Failed to save enrollment.", { status: 502 });
  }

  return Response.json({ leadId: lead.id });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Start the dev server and exercise the route**

Run: `npm run dev` (background)
Run:
```bash
curl -s -X POST http://localhost:3000/api/course-leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Student","phone":"+919876543210","email":"test@example.com","productId":"a1-french","productTitle":"A1 French Foundation Course"}'
```
Expected: JSON body `{"leadId":"course-lead-..."}`. Then:
```bash
curl -s -X POST http://localhost:3000/api/course-leads -H "Content-Type: application/json" -d '{}'
```
Expected: HTTP 400 (missing required fields). Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add app/api/course-leads/route.ts
git commit -m "feat: add POST /api/course-leads"
```

---

### Task 4: `/api/course-payment/create-order` route

**Files:**
- Create: `app/api/course-payment/create-order/route.ts`

**Interfaces:**
- Consumes: `findEnrollableByProductId`, `enrollablePriceInPaise`, `enrollableTitle` from `lib/courseCatalogData.ts` (Task 1); `getSupabaseAdmin` from `lib/supabaseAdmin.ts`; `CoursePayment`, `coursePaymentToRow` from `lib/coursePaymentData.ts` (Task 2). Reads `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` from env (already set in `.env.local`/Vercel).
- Produces: `POST /api/course-payment/create-order` — body `{ leadId?, name?, email?, phone?, productId }` → `{ orderId, amount, currency, title }` or 400/501/502.

- [ ] **Step 1: Write the route**

```ts
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { coursePaymentToRow, type CoursePayment } from "@/lib/coursePaymentData";
import { findEnrollableByProductId, enrollablePriceInPaise, enrollableTitle } from "@/lib/courseCatalogData";

type CreateOrderBody = {
  leadId?: string;
  name?: string;
  email?: string;
  phone?: string;
  productId?: string;
};

export async function POST(req: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return new Response("Razorpay isn't configured.", { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateOrderBody;
  const { leadId, name, email, phone, productId } = body;

  if (!productId) {
    return new Response("Missing productId.", { status: 400 });
  }

  // The amount is never trusted from the client — it's re-derived here from
  // the catalog by productId, same principle as
  // app/api/payment/create-order/route.ts's flat-fee comment.
  const enrollable = findEnrollableByProductId(productId);
  if (!enrollable) {
    return new Response("Unknown course.", { status: 400 });
  }
  const amount = enrollablePriceInPaise(enrollable);
  const title = enrollableTitle(enrollable);

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: leadId ? `course-lead-${leadId}` : `course-enroll-${Date.now()}`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Razorpay course order creation failed", res.status, text);
    return new Response("Failed to create payment order.", { status: 502 });
  }

  const order = await res.json();

  if (leadId && name && email && phone) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const payment: CoursePayment = {
        id: order.id,
        leadId,
        name,
        email,
        phone,
        productId,
        productTitle: title,
        amount: order.amount,
        currency: order.currency,
        status: "created",
        razorpayPaymentId: null,
        createdAt: new Date().toISOString(),
        paidAt: null,
      };
      const { error } = await supabase.from("course_payments").insert(coursePaymentToRow(payment));
      if (error) console.error("Failed to record course payment attempt", error);
    }
  }

  return Response.json({ orderId: order.id, amount: order.amount, currency: order.currency, title });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Start the dev server and exercise the route**

Run: `npm run dev` (background)
Run:
```bash
curl -s -X POST http://localhost:3000/api/course-payment/create-order \
  -H "Content-Type: application/json" \
  -d '{"productId":"a1-french","name":"Test Student","email":"test@example.com","phone":"+919876543210"}'
```
Expected: JSON with `"amount":2000000`, `"currency":"INR"`, `"title":"A1 French Foundation Course"`, and a real `orderId` (Razorpay test order). Then:
```bash
curl -s -X POST http://localhost:3000/api/course-payment/create-order -H "Content-Type: application/json" -d '{"productId":"not-a-real-course"}'
```
Expected: HTTP 400 "Unknown course." Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add app/api/course-payment/create-order/route.ts
git commit -m "feat: add POST /api/course-payment/create-order"
```

---

### Task 5: `/api/course-payment/verify` route

**Files:**
- Create: `app/api/course-payment/verify/route.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` from `lib/supabaseAdmin.ts`. Reads `RAZORPAY_KEY_SECRET` from env.
- Produces: `POST /api/course-payment/verify` — body `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, leadId? }` → `{ verified: true }` or 400/501.

- [ ] **Step 1: Write the route**

```ts
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Verifies a completed Razorpay checkout server-side — mirrors
// app/api/payment/verify/route.ts's HMAC check exactly, but scoped to
// course_payments/course_leads. There's no seat/student side effect here:
// course-catalog products don't have a seat concept.
export async function POST(req: Request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return new Response("Razorpay isn't configured.", { status: 501 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new Response("Supabase isn't configured.", { status: 501 });
  }

  const body = (await req.json().catch(() => null)) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    leadId?: string;
  } | null;

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, leadId } = body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return new Response("Missing payment fields.", { status: 400 });
  }

  const expected = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(razorpay_signature);
  const verified = expectedBuf.length === gotBuf.length && timingSafeEqual(expectedBuf, gotBuf);

  if (!verified) {
    await supabase.from("course_payments").update({ status: "failed" }).eq("id", razorpay_order_id);
    if (leadId) await supabase.from("course_leads").update({ payment_status: "failed" }).eq("id", leadId);
    return new Response("Signature verification failed.", { status: 400 });
  }

  await supabase
    .from("course_payments")
    .update({ status: "paid", razorpay_payment_id, paid_at: new Date().toISOString() })
    .eq("id", razorpay_order_id);

  if (leadId) {
    await supabase
      .from("course_leads")
      .update({ payment_status: "paid", razorpay_order_id, razorpay_payment_id })
      .eq("id", leadId);
  }

  return Response.json({ verified: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Start the dev server and exercise the failure path**

Run: `npm run dev` (background)
Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/course-payment/verify \
  -H "Content-Type: application/json" \
  -d '{"razorpay_order_id":"order_fake","razorpay_payment_id":"pay_fake","razorpay_signature":"deadbeef"}'
```
Expected: `400`. (The happy path needs a real Razorpay checkout and is exercised manually in Task 14's end-to-end QA.) Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add app/api/course-payment/verify/route.ts
git commit -m "feat: add POST /api/course-payment/verify"
```

---

### Task 6: Client-side payment gateway boundary

**Files:**
- Create: `lib/coursePayment.ts`

**Interfaces:**
- Consumes: `loadRazorpayScript` from `lib/loadRazorpayScript.ts` (existing); `Window.Razorpay` global (already declared there).
- Produces: `CourseOrder`, `CourseCheckoutDetails`, `RazorpaySuccessResponse`, `createCourseOrder(input): Promise<CourseOrder>`, `openCourseCheckout(order, details, handlers): Promise<void>`.

- [ ] **Step 1: Write `lib/coursePayment.ts`**

```ts
"use client";

import { loadRazorpayScript } from "./loadRazorpayScript";

export type CourseOrder = { orderId: string; amount: number; currency: string; title: string };
export type CourseCheckoutDetails = { name: string; email: string; phone: string };
export type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

// Creates a Razorpay order server-side via /api/course-payment/create-order
// — the server re-derives the price from lib/courseCatalogData.ts by
// productId, so nothing here can inflate or discount the charged amount.
export async function createCourseOrder(input: {
  leadId: string;
  name: string;
  email: string;
  phone: string;
  productId: string;
}): Promise<CourseOrder> {
  const res = await fetch("/api/course-payment/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Couldn't start the payment. Please try again.");
  return res.json();
}

// Opens Razorpay's checkout for an already-created order.
//
// WHERE TO WIRE A LIVE GATEWAY: this project already has a real Razorpay
// integration on a TEST key — RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
// (server-only, used in app/api/course-payment/create-order and
// app/api/course-payment/verify) and NEXT_PUBLIC_RAZORPAY_KEY_ID (public,
// read below). To go live, replace those three values with live-mode
// credentials in .env.local / Vercel env vars — no code change is needed
// here or in the API routes.
export async function openCourseCheckout(
  order: CourseOrder,
  details: CourseCheckoutDetails,
  handlers: {
    onSuccess: (response: RazorpaySuccessResponse) => void | Promise<void>;
    onDismiss: () => void;
  }
): Promise<void> {
  const scriptOk = await loadRazorpayScript();
  if (!scriptOk || !window.Razorpay) {
    throw new Error("Couldn't load the payment widget. Check your connection and try again.");
  }

  const razorpay = new window.Razorpay({
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    amount: order.amount,
    currency: order.currency,
    order_id: order.orderId,
    name: "The Français Hub",
    description: order.title,
    prefill: { name: details.name, email: details.email, contact: details.phone },
    method: { upi: true, card: true, netbanking: true, wallet: true, paylater: true },
    theme: { color: "#1F3A5F" },
    handler: handlers.onSuccess,
    modal: { ondismiss: handlers.onDismiss },
  });
  razorpay.open();
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/coursePayment.ts
git commit -m "feat: add course checkout gateway boundary (createCourseOrder/openCourseCheckout)"
```

---

### Task 7: `CourseCard` component + catalog grid styling

**Files:**
- Create: `components/CourseCard.tsx`
- Modify: `app/globals.css` (append new block at end of file)

**Interfaces:**
- Consumes: `Course` from `lib/courseCatalogData.ts` (Task 1); `formatRupees` from `lib/formatCurrency.ts` (Task 1).
- Produces: `CourseCard({ course, onViewDetails, onEnroll }): JSX.Element`.

- [ ] **Step 1: Write `components/CourseCard.tsx`**

```tsx
import type { Course } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";

export function CourseCard({
  course,
  onViewDetails,
  onEnroll,
}: {
  course: Course;
  onViewDetails: () => void;
  onEnroll: () => void;
}) {
  return (
    <article className="course-card">
      {course.badge && <span className="course-card__badge">{course.badge}</span>}
      <span className="course-card__category">{course.category}</span>
      <h3>{course.title}</h3>
      <p className="course-card__desc">{course.description}</p>
      <div className="course-card__meta">
        {course.level && <span>{course.level}</span>}
        <span>{course.duration}</span>
        <span>{course.mode}</span>
      </div>
      <div className="course-card__price-row">
        <span className="course-card__price">{formatRupees(course.priceInPaise)}</span>
        {course.regularPriceInPaise !== undefined && (
          <span className="course-card__regular-price">{formatRupees(course.regularPriceInPaise)}</span>
        )}
      </div>
      {course.savingsInPaise !== undefined && (
        <span className="course-card__savings">Save {formatRupees(course.savingsInPaise)}</span>
      )}
      <div className="course-card__actions">
        <button type="button" className="button button--outline" onClick={onViewDetails}>View Details</button>
        <button type="button" className="button button--accent" onClick={onEnroll}>Enroll Now</button>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Append course catalog CSS to `app/globals.css`**

Append at the end of the file (after the existing `.chat-widget__note` rule):

```css

/* course catalog */
.course-catalog { background: var(--porcelain); border-top: 1px solid var(--stone); }
.course-catalog__subtitle { max-width: 640px; margin: 1.4rem 0 0; color: var(--text-muted); font-size: .9rem; line-height: 1.85; }
.course-catalog__filters { display:flex; flex-wrap:wrap; gap:.6rem; margin: 2.2rem 0 2.8rem; }
.course-catalog__filter { border:1px solid rgba(16,19,28,.14); background:rgba(255,255,255,.5); border-radius:999px; padding:.6rem 1.1rem; font-size:.72rem; font-weight:700; cursor:pointer; transition:background .3s var(--ease), border-color .3s var(--ease), color .3s var(--ease), transform .2s var(--ease); }
.course-catalog__filter:hover { transform:translateY(-2px); border-color:rgba(16,19,28,.28); }
.course-catalog__filter.is-active { background:var(--blue); border-color:var(--blue); color:var(--porcelain); }
.course-catalog__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.1rem; }

.course-card { display: flex; flex-direction: column; gap: .7rem; padding: 2rem; border-radius: var(--r-lg); background: var(--card-surface); border: 1px solid var(--hairline-ink); box-shadow: var(--shadow-soft); position: relative; transition: transform .35s var(--ease), box-shadow .35s var(--ease), border-color .35s var(--ease); }
.course-card:hover { transform: translateY(-6px); box-shadow: var(--shadow-lift); border-color: var(--hairline-ink-hover); }
.course-card__badge { position: absolute; top: 1.4rem; right: 1.4rem; text-transform: uppercase; letter-spacing: .1em; font-size: .58rem; font-weight: 700; color: var(--bordeaux); background: rgba(182,58,58,.08); border: 1px solid rgba(182,58,58,.18); border-radius: 999px; padding: .4rem .75rem; }
.course-card__category { color: var(--blue); font-size: .62rem; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; }
.course-card h3 { font-family: var(--serif); font-size: 1.7rem; margin: 0; color: var(--blue); line-height: 1.08; padding-right: 4.5rem; }
.course-card__desc { margin: 0; font-size: .84rem; line-height: 1.7; color: var(--text-muted); flex: 1; }
.course-card__meta { display: flex; flex-wrap: wrap; gap: .5rem; }
.course-card__meta span { border: 1px solid var(--stone); border-radius: 999px; padding: .35rem .75rem; font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-faint); }
.course-card__price-row { display: flex; align-items: baseline; gap: .6rem; margin-top: .3rem; }
.course-card__price { font-family: var(--serif); font-size: 1.9rem; color: var(--bordeaux); }
.course-card__regular-price { font-size: .82rem; color: var(--text-faint); text-decoration: line-through; }
.course-card__savings { align-self: flex-start; font-size: .64rem; font-weight: 700; color: var(--emerald); background: rgba(63,138,99,.1); border-radius: 999px; padding: .3rem .7rem; }
.course-card__actions { display: flex; gap: .6rem; margin-top: .6rem; }
.course-card__actions .button { flex: 1; min-height: 46px; padding: .7rem 1rem; font-size: .7rem; }

@media (max-width: 1100px) {
  .course-catalog__grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 800px) {
  .course-catalog__grid { grid-template-columns: 1fr; }
  .course-catalog__filters { gap: .5rem; }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/CourseCard.tsx app/globals.css
git commit -m "feat: add CourseCard component and course catalog styling"
```

---

### Task 8: `CourseDetailsModal` component

**Files:**
- Create: `components/CourseDetailsModal.tsx`
- Create: `components/CourseModals.module.css`

**Interfaces:**
- Consumes: `Course` from `lib/courseCatalogData.ts`; `formatRupees` from `lib/formatCurrency.ts`; classes from `components/EnrollModal.module.css` (existing, reused as-is).
- Produces: `CourseDetailsModal({ course, onClose, onEnroll }): JSX.Element`. `components/CourseModals.module.css` classes (`.detailsCard`, `.detailsSubline`, `.priceRow`, `.price`, `.regularPrice`, `.savings`, `.factsRow`, `.section`, `.checkList`, `.enrollCta`) — extended further in Task 11.

- [ ] **Step 1: Write `components/CourseModals.module.css`**

```css
.detailsCard { max-width: 560px; }

.detailsSubline { margin: 0 0 1rem; color: var(--text-muted); font-size: .78rem; font-weight: 600; letter-spacing: .02em; }

.priceRow { display: flex; align-items: baseline; flex-wrap: wrap; gap: .7rem; margin-bottom: 1.4rem; }

.price { font-family: var(--serif); font-size: 2.4rem; color: var(--bordeaux); }

.regularPrice { font-size: .9rem; color: var(--text-faint); text-decoration: line-through; }

.savings { font-size: .64rem; font-weight: 700; color: var(--emerald); background: rgba(63,138,99,.1); border-radius: 999px; padding: .3rem .7rem; }

.factsRow { display: flex; flex-wrap: wrap; gap: 0; border-top: 1px solid var(--stone); border-bottom: 1px solid var(--stone); padding: 1.2rem 0; margin-bottom: 1.6rem; }

.factsRow span { padding: 0 1.3rem; border-left: 1px solid var(--stone); font-size: .82rem; font-weight: 700; color: var(--blue); display: block; }

.factsRow span:first-child { padding-left: 0; border-left: 0; }

.factsRow small { display: block; font-size: .52rem; text-transform: uppercase; letter-spacing: .1em; color: var(--text-faint); font-weight: 600; margin-bottom: .3rem; }

.section { margin-bottom: 1.6rem; }

.section h4 { font-family: var(--serif); font-weight: 400; font-size: 1.15rem; margin: 0 0 .6rem; color: var(--blue); }

.section p { margin: 0; font-size: .84rem; line-height: 1.75; color: var(--text-muted); }

.checkList { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: .55rem .9rem; }

.checkList li { position: relative; padding-left: 1.3rem; font-size: .82rem; color: var(--ink); line-height: 1.5; }

.checkList li::before { content: ""; position: absolute; left: 0; top: .5em; width: 7px; height: 7px; border-radius: 50%; background: var(--bordeaux); }

.enrollCta { width: 100%; margin-top: .4rem; }

@media (max-width: 480px) {
  .checkList { grid-template-columns: 1fr; }
  .factsRow { flex-direction: column; gap: .8rem; }
  .factsRow span { padding: 0; border-left: 0; }
}
```

- [ ] **Step 2: Write `components/CourseDetailsModal.tsx`**

```tsx
"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import type { Course } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";
import enrollStyles from "./EnrollModal.module.css";
import styles from "./CourseModals.module.css";

export function CourseDetailsModal({
  course,
  onClose,
  onEnroll,
}: {
  course: Course;
  onClose: () => void;
  onEnroll: () => void;
}) {
  useEffect(() => {
    document.body.classList.add("enroll-modal-open");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("enroll-modal-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      className={enrollStyles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={`${enrollStyles.card} ${styles.detailsCard}`}
        initial={{ opacity: 0, y: 18, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: .98 }}
        transition={{ duration: .25 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${course.title} details`}
      >
        <button type="button" className={enrollStyles.close} onClick={onClose} aria-label="Close">×</button>

        <span className={enrollStyles.batchTag}>{course.category}</span>
        <h3>{course.title}</h3>
        <p className={styles.detailsSubline}>
          {[course.level, course.duration].filter(Boolean).join(" • ")}
        </p>
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatRupees(course.priceInPaise)}</span>
          {course.regularPriceInPaise !== undefined && (
            <span className={styles.regularPrice}>{formatRupees(course.regularPriceInPaise)}</span>
          )}
          {course.savingsInPaise !== undefined && (
            <span className={styles.savings}>Save {formatRupees(course.savingsInPaise)}</span>
          )}
        </div>

        <div className={styles.factsRow}>
          {course.minimumLevel && <span><small>Minimum Level</small>{course.minimumLevel}</span>}
          <span><small>Duration</small>{course.duration}</span>
          {course.maxDuration && <span><small>Maximum Duration</small>{course.maxDuration}</span>}
          {course.classes !== undefined && <span><small>Classes</small>{course.classes}</span>}
          <span><small>Mode</small>{course.mode}</span>
        </div>

        <section className={styles.section}>
          <h4>Course Overview</h4>
          <p>{course.overview}</p>
        </section>

        <section className={styles.section}>
          <h4>What You&apos;ll Learn</h4>
          <ul className={styles.checkList}>
            {course.whatYouLearn.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className={styles.section}>
          <h4>Course Includes</h4>
          <ul className={styles.checkList}>
            {course.includes.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        {course.target && (
          <section className={styles.section}>
            <h4>Target</h4>
            <p>{course.target}</p>
          </section>
        )}

        <button type="button" className={`button button--accent ${styles.enrollCta}`} onClick={onEnroll}>
          Enroll Now →
        </button>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/CourseDetailsModal.tsx components/CourseModals.module.css
git commit -m "feat: add CourseDetailsModal component"
```

---

### Task 9: `DelfPricingTable` component

**Files:**
- Create: `components/DelfPricingTable.tsx`
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes: `delfCourses`, `DelfLevel`, `DelfOption` from `lib/courseCatalogData.ts`; `formatRupees` from `lib/formatCurrency.ts`; `Reveal` from `components/Reveal.tsx`.
- Produces: `DelfPricingTable({ onEnroll }): JSX.Element` where `onEnroll: (level: DelfLevel, option: DelfOption) => void`.

- [ ] **Step 1: Write `components/DelfPricingTable.tsx`**

```tsx
"use client";

import { delfCourses, type DelfLevel, type DelfOption } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";
import { Reveal } from "./Reveal";

export function DelfPricingTable({ onEnroll }: { onEnroll: (level: DelfLevel, option: DelfOption) => void }) {
  return (
    <Reveal className="delf-pricing">
      <div className="delf-pricing__head">
        <p className="eyebrow">DELF Preparation</p>
        <h3>Speaking, writing, or both.</h3>
      </div>

      <div className="delf-pricing__table" role="table" aria-label="DELF preparation pricing by level">
        <div className="delf-pricing__row delf-pricing__row--head" role="row">
          <span role="columnheader">Course</span>
          <span role="columnheader">Speaking</span>
          <span role="columnheader">Writing</span>
          <span role="columnheader">Speaking + Writing</span>
        </div>
        {delfCourses.map((d) => (
          <div className="delf-pricing__row" role="row" key={d.level}>
            <span className="delf-pricing__level" role="cell">DELF {d.level}</span>
            {d.options.map((option) => (
              <span className="delf-pricing__cell" role="cell" data-label={option.label} key={option.kind}>
                <strong>{formatRupees(option.priceInPaise)}</strong>
                <small>{option.sessions} sessions</small>
                <button type="button" className="delf-pricing__enroll" onClick={() => onEnroll(d.level, option)}>
                  Enroll
                </button>
              </span>
            ))}
          </div>
        ))}
      </div>
    </Reveal>
  );
}
```

- [ ] **Step 2: Append DELF matrix CSS to `app/globals.css`**

Append after the course-catalog block added in Task 7 (before its closing responsive media queries, or after them — order doesn't matter, just keep it inside the same "course catalog" section of the file):

```css

/* DELF pricing matrix */
.delf-pricing { margin-top: 4.5rem; }
.delf-pricing__head { margin-bottom: 1.6rem; }
.delf-pricing__head h3 { font-family: var(--serif); font-size: clamp(1.9rem, 3vw, 2.6rem); margin: 0; color: var(--blue); }
.delf-pricing__table { border: 1px solid var(--hairline-ink); border-radius: var(--r-lg); overflow: hidden; background: var(--card-surface); box-shadow: var(--shadow-soft); }
.delf-pricing__row { display: grid; grid-template-columns: .9fr 1fr 1fr 1fr; border-top: 1px solid var(--hairline-ink); }
.delf-pricing__row:first-child { border-top: 0; }
.delf-pricing__row--head { background: var(--stone-wash); }
.delf-pricing__row--head span { padding: 1rem 1.2rem; font-size: .64rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--text-muted); }
.delf-pricing__level { display: flex; align-items: center; padding: 1.2rem; font-family: var(--serif); font-size: 1.15rem; color: var(--blue); border-right: 1px solid var(--hairline-ink); }
.delf-pricing__cell { display: flex; flex-direction: column; align-items: flex-start; gap: .35rem; padding: 1.2rem; border-right: 1px solid var(--hairline-ink); }
.delf-pricing__cell:last-child { border-right: 0; }
.delf-pricing__cell strong { font-family: var(--serif); font-size: 1.15rem; color: var(--bordeaux); }
.delf-pricing__cell small { font-size: .68rem; color: var(--text-faint); }
.delf-pricing__enroll { margin-top: .3rem; border: 1px solid var(--blue); border-radius: 999px; background: transparent; color: var(--blue); font-size: .64rem; font-weight: 700; padding: .45rem .9rem; cursor: pointer; transition: background .25s var(--ease), color .25s var(--ease); }
.delf-pricing__enroll:hover { background: var(--blue); color: var(--porcelain); }

@media (max-width: 1100px) {
  .delf-pricing__row { grid-template-columns: .8fr 1fr 1fr 1fr; }
}

@media (max-width: 800px) {
  .delf-pricing__row { grid-template-columns: 1fr; }
  .delf-pricing__level { border-right: 0; border-bottom: 1px solid var(--hairline-ink); }
  .delf-pricing__cell { border-right: 0; border-bottom: 1px solid var(--hairline-ink); }
  .delf-pricing__row--head { display: none; }
  .delf-pricing__cell::before { content: attr(data-label); font-size: .6rem; text-transform: uppercase; letter-spacing: .1em; color: var(--text-faint); font-weight: 700; }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/DelfPricingTable.tsx app/globals.css
git commit -m "feat: add DelfPricingTable component"
```

---

### Task 10: `OrientationTestCard` component

**Files:**
- Create: `components/OrientationTestCard.tsx`
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes: `orientationLevels`, `OrientationLevel` from `lib/courseCatalogData.ts`; `formatRupees` from `lib/formatCurrency.ts`; `Reveal` from `components/Reveal.tsx`.
- Produces: `OrientationTestCard({ onEnroll }): JSX.Element` where `onEnroll: (level: OrientationLevel) => void`.

- [ ] **Step 1: Write `components/OrientationTestCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { orientationLevels, type OrientationLevel } from "@/lib/courseCatalogData";
import { formatRupees } from "@/lib/formatCurrency";
import { Reveal } from "./Reveal";

export function OrientationTestCard({ onEnroll }: { onEnroll: (level: OrientationLevel) => void }) {
  const [selected, setSelected] = useState<OrientationLevel["level"]>("A1");
  const active = orientationLevels.find((o) => o.level === selected) ?? orientationLevels[0];

  return (
    <Reveal className="orientation-card">
      <div className="orientation-card__copy">
        <p className="eyebrow">Not sure where to start?</p>
        <h3>French Orientation Test</h3>
        <p>A short placement test to confirm your current level before you commit to a course.</p>
      </div>
      <div className="orientation-card__levels" role="group" aria-label="Select orientation test level">
        {orientationLevels.map((o) => (
          <button
            key={o.level}
            type="button"
            className={`orientation-card__level ${selected === o.level ? "is-active" : ""}`}
            aria-pressed={selected === o.level}
            onClick={() => setSelected(o.level)}
          >
            <span>{o.level}</span>
            <strong>{formatRupees(o.priceInPaise)}</strong>
          </button>
        ))}
      </div>
      <button type="button" className="button button--accent" onClick={() => onEnroll(active)}>
        Enroll — {active.level} · {formatRupees(active.priceInPaise)}
      </button>
    </Reveal>
  );
}
```

- [ ] **Step 2: Append orientation card CSS to `app/globals.css`**

```css

/* orientation test */
.orientation-card { margin-top: 3rem; display: flex; flex-wrap: wrap; align-items: center; gap: 1.8rem; padding: 2.2rem; border-radius: var(--r-lg); background: linear-gradient(165deg, var(--blue-2), var(--blue)); color: var(--porcelain); box-shadow: var(--shadow-lift); }
.orientation-card__copy { flex: 1 1 260px; }
.orientation-card__copy .eyebrow { color: var(--bordeaux-light); background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.24); }
.orientation-card__copy h3 { font-family: var(--serif); font-size: 1.9rem; margin: .5rem 0; }
.orientation-card__copy p { margin: 0; font-size: .84rem; line-height: 1.7; color: rgba(246,244,239,.72); max-width: 380px; }
.orientation-card__levels { display: flex; gap: .6rem; flex-wrap: wrap; }
.orientation-card__level { display: flex; flex-direction: column; align-items: center; gap: .3rem; min-width: 76px; padding: .8rem 1rem; border-radius: var(--r-md); border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06); color: var(--porcelain); cursor: pointer; transition: background .25s var(--ease), border-color .25s var(--ease), transform .25s var(--ease); }
.orientation-card__level span { font-size: .62rem; letter-spacing: .1em; text-transform: uppercase; color: rgba(246,244,239,.65); }
.orientation-card__level strong { font-family: var(--serif); font-size: 1rem; }
.orientation-card__level:hover { transform: translateY(-2px); }
.orientation-card__level.is-active { background: var(--bordeaux); border-color: var(--bordeaux); }

@media (max-width: 800px) {
  .orientation-card { flex-direction: column; align-items: flex-start; }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/OrientationTestCard.tsx app/globals.css
git commit -m "feat: add OrientationTestCard component"
```

---

### Task 11: `CourseEnrollModal` — enrollment form → payment → success/failure

**Files:**
- Create: `components/CourseEnrollModal.tsx`
- Modify: `components/CourseModals.module.css` (append)

**Interfaces:**
- Consumes: `enrollableProductId`, `enrollableTitle`, `enrollablePriceInPaise`, `Enrollable` from `lib/courseCatalogData.ts`; `CURRENT_LEVELS`, `CurrentLevel`, `LEARNING_MODES`, `LearningMode` from `lib/courseLeadData.ts`; `formatRupees` from `lib/formatCurrency.ts`; `createCourseOrder`, `openCourseCheckout`, `RazorpaySuccessResponse` from `lib/coursePayment.ts`; `WhatsAppLink` from `components/WhatsAppLink.tsx`; classes from `components/EnrollModal.module.css` and `components/CourseModals.module.css`. Calls `POST /api/course-leads`.
- Produces: `CourseEnrollModal({ enrollable, onClose }): JSX.Element`.

- [ ] **Step 1: Append the remaining shared classes to `components/CourseModals.module.css`**

```css

.summaryBox { display: flex; flex-direction: column; gap: .8rem; padding: 1.1rem 1.3rem; border-radius: var(--r-md); background: rgba(31,58,95,.05); border: 1px solid rgba(31,58,95,.1); margin: 1rem 0 1.5rem; }

.summaryBox span { display: flex; flex-direction: column; gap: .2rem; font-size: .92rem; font-weight: 700; color: var(--blue); }

.summaryBox small { font-size: .58rem; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; color: var(--text-faint); }

.fieldError { color: var(--bordeaux); font-size: .66rem; font-weight: 600; margin-top: -.15rem; }

.formError { margin: -.3rem 0 0; padding: .7rem .9rem; border-radius: 8px; background: #fbe9e7; color: #9c2f2f; font-size: .74rem; line-height: 1.5; }

.secureNote { display: flex; align-items: center; gap: .4rem; font-size: .72rem; color: var(--text-muted); margin: 0 0 1.4rem; }
```

- [ ] **Step 2: Write `components/CourseEnrollModal.tsx`**

```tsx
"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  enrollableProductId,
  enrollableTitle,
  enrollablePriceInPaise,
  type Enrollable,
} from "@/lib/courseCatalogData";
import { CURRENT_LEVELS, LEARNING_MODES, type CurrentLevel, type LearningMode } from "@/lib/courseLeadData";
import { formatRupees } from "@/lib/formatCurrency";
import { createCourseOrder, openCourseCheckout, type RazorpaySuccessResponse } from "@/lib/coursePayment";
import { WhatsAppLink } from "./WhatsAppLink";
import enrollStyles from "./EnrollModal.module.css";
import styles from "./CourseModals.module.css";

// Digits only, plus a single optional leading "+" for any country code —
// copied from components/EnrollModal.tsx rather than imported, so the two
// enrollment flows stay fully decoupled (per the isolation requirement in
// docs/superpowers/specs/2026-09-10-courses-section-design.md).
function sanitizePhone(value: string) {
  const hasLeadingPlus = value.trimStart().startsWith("+");
  const digitsAndSpaces = value.replace(/[^\d\s]/g, "");
  return hasLeadingPlus ? `+${digitsAndSpaces.trimStart()}` : digitsAndSpaces;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s]{7,15}$/;

type Phase = "form" | "payment" | "processing" | "paid" | "payment_failed";
type FieldErrors = Partial<Record<"name" | "email" | "phone", string>>;

export function CourseEnrollModal({ enrollable, onClose }: { enrollable: Enrollable; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [currentLevel, setCurrentLevel] = useState<CurrentLevel | "">("");
  const [preferredMode, setPreferredMode] = useState<LearningMode | "">("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<{ leadId: string } | null>(null);

  const title = enrollableTitle(enrollable);
  const priceInPaise = enrollablePriceInPaise(enrollable);
  const productId = enrollableProductId(enrollable);

  useEffect(() => {
    document.body.classList.add("enroll-modal-open");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "processing") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("enroll-modal-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, phase]);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Full name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    if (!phone.trim()) next.phone = "Phone number is required.";
    else if (!PHONE_RE.test(phone.trim())) next.phone = "Enter a valid phone number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    try {
      const res = await fetch("/api/course-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          productId,
          productTitle: title,
          currentLevel: currentLevel || undefined,
          preferredMode: preferredMode || undefined,
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      const { leadId } = (await res.json()) as { leadId: string };
      pendingRef.current = { leadId };
      setPhase("payment");
    } catch {
      setError("Couldn't save your enrollment. Please try again.");
    }
  }

  async function startPayment() {
    if (!pendingRef.current) return;
    setPhase("processing");
    setError(null);

    try {
      const order = await createCourseOrder({
        leadId: pendingRef.current.leadId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        productId,
      });

      await openCourseCheckout(
        order,
        { name: name.trim(), email: email.trim(), phone: phone.trim() },
        {
          onSuccess: async (response: RazorpaySuccessResponse) => {
            try {
              const verifyRes = await fetch("/api/course-payment/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...response, leadId: pendingRef.current?.leadId }),
              });
              if (!verifyRes.ok) throw new Error();
              setPhase("paid");
            } catch {
              setError("Payment went through, but we couldn't confirm it automatically — we'll verify manually.");
              setPhase("payment_failed");
            }
          },
          onDismiss: () => {
            setError("Payment wasn't completed. Your enrollment is still saved — you can try paying again.");
            setPhase("payment_failed");
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong starting the payment.");
      setPhase("payment_failed");
    }
  }

  return (
    <motion.div
      className={enrollStyles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={phase === "processing" ? undefined : onClose}
    >
      <motion.div
        className={enrollStyles.card}
        initial={{ opacity: 0, y: 18, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: .98 }}
        transition={{ duration: .25 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Enroll for a course"
      >
        {phase !== "processing" && (
          <button type="button" className={enrollStyles.close} onClick={onClose} aria-label="Close">×</button>
        )}

        {phase === "form" && (
          <>
            <div className={enrollStyles.batchTag}>Enroll now</div>
            <h3>Tell us about yourself.</h3>
            <p className={enrollStyles.batchMeta}>A few details, then continue to payment to secure your seat.</p>

            <div className={styles.summaryBox}>
              <span><small>Selected Course</small>{title}</span>
              <span><small>Course Fee</small>{formatRupees(priceInPaise)}</span>
            </div>

            <form className={enrollStyles.form} onSubmit={handleFormSubmit} noValidate>
              <label>
                <span>Full name *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-invalid={errors.name ? "true" : "false"} />
                {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
              </label>

              <div className={enrollStyles.fieldRow}>
                <label>
                  <span>Email address *</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-invalid={errors.email ? "true" : "false"} />
                  {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                </label>
                <label>
                  <span>Phone number *</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                    placeholder="e.g. +91 98765 43210"
                    aria-invalid={errors.phone ? "true" : "false"}
                  />
                  {errors.phone && <span className={styles.fieldError}>{errors.phone}</span>}
                </label>
              </div>

              <label>
                <span>WhatsApp number (optional)</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(sanitizePhone(e.target.value))}
                  placeholder="If different from phone"
                />
              </label>

              <div className={enrollStyles.fieldRow}>
                <label>
                  <span>Current French level</span>
                  <select value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value as CurrentLevel | "")}>
                    <option value="">Not sure / prefer to discuss</option>
                    {CURRENT_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </label>
                <label>
                  <span>Preferred learning mode</span>
                  <select value={preferredMode} onChange={(e) => setPreferredMode(e.target.value as LearningMode | "")}>
                    <option value="">No preference</option>
                    {LEARNING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>

              <label>
                <span>Message / additional requirements (optional)</span>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Target exam date, scheduling constraints, goals…" rows={3} />
              </label>

              {error && <p className={styles.formError}>{error}</p>}

              <button type="submit" className={enrollStyles.submit}>Continue to Payment</button>
            </form>
          </>
        )}

        {phase === "payment" && (
          <div className={enrollStyles.success}>
            <div className={enrollStyles.batchTag}>Complete Your Enrollment</div>
            <h3>{title}</h3>
            <div className={styles.summaryBox}>
              <span><small>Student</small>{name}</span>
              <span><small>Course Fee</small>{formatRupees(priceInPaise)}</span>
            </div>
            <p className={styles.secureNote}>🔒 Secure payment via Razorpay</p>
            {error && <p className={styles.formError}>{error}</p>}
            <button type="button" className={enrollStyles.submit} onClick={startPayment}>Pay Now</button>
            <button type="button" className={enrollStyles.secondary} onClick={() => setPhase("form")}>Back to Enrollment</button>
          </div>
        )}

        {phase === "processing" && (
          <div className={enrollStyles.success}>
            <div className={enrollStyles.batchTag}>Processing</div>
            <h3>Opening secure payment…</h3>
            <p className={enrollStyles.batchMeta}>Complete the {formatRupees(priceInPaise)} payment in the Razorpay window. Don&apos;t close this tab.</p>
          </div>
        )}

        {phase === "paid" && (
          <div className={enrollStyles.success}>
            <div className={enrollStyles.batchTag}>Enrollment Successful 🎉</div>
            <h3>Thanks, {name.split(" ")[0]}!</h3>
            <div className={styles.summaryBox}>
              <span><small>Course</small>{title}</span>
              <span><small>Student</small>{name}</span>
              <span><small>Amount Paid</small>{formatRupees(priceInPaise)}</span>
            </div>
            <p className={enrollStyles.batchMeta}>Your enrollment has been successfully submitted. We&apos;ll reach out on {phone} or {email} to get you started.</p>
            <div className={enrollStyles.fieldRow}>
              <button type="button" className={enrollStyles.submit} onClick={onClose}>Back to Courses</button>
              <WhatsAppLink className={enrollStyles.secondary} message={`Hi! I just enrolled in ${title} and would like to know the next steps.`}>Contact The Français Hub</WhatsAppLink>
            </div>
          </div>
        )}

        {phase === "payment_failed" && (
          <div className={enrollStyles.success}>
            <div className={enrollStyles.batchTag}>Payment Unsuccessful</div>
            <h3>Your payment couldn&apos;t be completed.</h3>
            <p className={enrollStyles.batchMeta}>{error}</p>
            <div className={enrollStyles.fieldRow}>
              <button type="button" className={enrollStyles.submit} onClick={startPayment}>Try Again</button>
              <button type="button" className={enrollStyles.secondary} onClick={() => setPhase("form")}>Back to Enrollment</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/CourseEnrollModal.tsx components/CourseModals.module.css
git commit -m "feat: add CourseEnrollModal with validation, payment, success/failure states"
```

---

### Task 12: `CourseCatalog` — wires filters, grid, DELF matrix, orientation, and both modals

**Files:**
- Create: `components/CourseCatalog.tsx`

**Interfaces:**
- Consumes: `courses`, `CourseCategory`, `Course`, `Enrollable` from `lib/courseCatalogData.ts`; `Reveal`; `CourseCard` (Task 7); `CourseDetailsModal` (Task 8); `DelfPricingTable` (Task 9); `OrientationTestCard` (Task 10); `CourseEnrollModal` (Task 11); `AnimatePresence` from `motion/react`.
- Produces: `CourseCatalog(): JSX.Element` — the full `/courses` page body.

- [ ] **Step 1: Write `components/CourseCatalog.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Reveal } from "./Reveal";
import { CourseCard } from "./CourseCard";
import { CourseDetailsModal } from "./CourseDetailsModal";
import { CourseEnrollModal } from "./CourseEnrollModal";
import { DelfPricingTable } from "./DelfPricingTable";
import { OrientationTestCard } from "./OrientationTestCard";
import { courses, type Course, type CourseCategory, type Enrollable } from "@/lib/courseCatalogData";

const FILTERS: ("All" | CourseCategory)[] = ["All", "French Levels", "TEF", "TCF", "DELF", "Orientation"];

export function CourseCatalog() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [detailsCourse, setDetailsCourse] = useState<Course | null>(null);
  const [enrolling, setEnrolling] = useState<Enrollable | null>(null);

  const visibleCourses = useMemo(() => {
    if (filter === "All") return courses;
    if (filter === "DELF" || filter === "Orientation") return [];
    return courses.filter((c) => c.category === filter);
  }, [filter]);

  const showDelf = filter === "All" || filter === "DELF";
  const showOrientation = filter === "All" || filter === "Orientation";

  return (
    <section className="section course-catalog">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">Explore Our Courses</p>
          <h2>Choose the right <em>French program.</em></h2>
          <p className="course-catalog__subtitle">
            Choose the right French learning program for your goals. From complete beginner courses to advanced exam preparation, find a program designed around your target.
          </p>
        </Reveal>

        <div className="course-catalog__filters" role="group" aria-label="Filter courses by category">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`course-catalog__filter ${filter === f ? "is-active" : ""}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </div>

        {visibleCourses.length > 0 && (
          <div className="course-catalog__grid">
            {visibleCourses.map((course, i) => (
              <Reveal key={course.id} delay={i * 0.05}>
                <CourseCard
                  course={course}
                  onViewDetails={() => setDetailsCourse(course)}
                  onEnroll={() => setEnrolling({ kind: "course", course })}
                />
              </Reveal>
            ))}
          </div>
        )}

        {showDelf && (
          <DelfPricingTable onEnroll={(level, option) => setEnrolling({ kind: "delf", level, option })} />
        )}

        {showOrientation && (
          <OrientationTestCard onEnroll={(level) => setEnrolling({ kind: "orientation", level })} />
        )}
      </div>

      <AnimatePresence>
        {detailsCourse && (
          <CourseDetailsModal
            course={detailsCourse}
            onClose={() => setDetailsCourse(null)}
            onEnroll={() => {
              const course = detailsCourse;
              setDetailsCourse(null);
              setEnrolling({ kind: "course", course });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {enrolling && <CourseEnrollModal enrollable={enrolling} onClose={() => setEnrolling(null)} />}
      </AnimatePresence>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/CourseCatalog.tsx
git commit -m "feat: add CourseCatalog orchestrating filters, grid, DELF matrix, orientation, modals"
```

---

### Task 13: `/courses` page + navigation + footer links

**Files:**
- Create: `app/courses/page.tsx`
- Modify: `components/Navigation.tsx:9-15` (add nav link)
- Modify: `components/Footer.tsx:10-16` (add footer link)

**Interfaces:**
- Consumes: `PageHero` from `components/PageHero.tsx`; `CourseCatalog` from `components/CourseCatalog.tsx` (Task 12); `FinalCta` from `components/FinalCta.tsx`.
- Produces: route `/courses`.

- [ ] **Step 1: Write `app/courses/page.tsx`**

```tsx
import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { CourseCatalog } from "@/components/CourseCatalog";
import { FinalCta } from "@/components/FinalCta";

export const metadata: Metadata = {
  title: "Courses",
  description: "Explore The Français Hub's French courses — from A1 foundations to C1 mastery, TEF/TCF exam preparation, DELF certification, and orientation testing.",
};

export default function CoursesPage() {
  return <>
    <PageHero
      eyebrow="Courses"
      title="Explore Our"
      italic="Courses."
      body="Choose the right French learning program for your goals. From complete beginner courses to advanced exam preparation, find a program designed around your target."
      trail={[{ label: "Discover", href: "/" }, { label: "Courses" }]}
    />
    <CourseCatalog />
    <FinalCta />
  </>;
}
```

- [ ] **Step 2: Add the nav link in `components/Navigation.tsx`**

Change:
```tsx
const links = [
  ["Programs", "/#programs"],
  ["Le Hub", "/le-hub"],
  ["About", "/about"],
  ["Results", "/results"],
  ["Resources", "/resources"],
];
```
to:
```tsx
const links = [
  ["Programs", "/#programs"],
  ["Courses", "/courses"],
  ["Le Hub", "/le-hub"],
  ["About", "/about"],
  ["Results", "/results"],
  ["Resources", "/resources"],
];
```
(This single array feeds both the desktop nav and the mobile menu — no other change needed in that file.)

- [ ] **Step 3: Add the footer link in `components/Footer.tsx`**

Change:
```tsx
        <div className="footer__col">
          <span className="footer__heading">Programs</span>
          <Link href="/tef-tcf">TEF / TCF</Link>
          <Link href="/delf">DELF</Link>
          <Link href="/find-your-batch">Find your batch</Link>
          <Link href="/le-hub">Le Hub</Link>
        </div>
```
to:
```tsx
        <div className="footer__col">
          <span className="footer__heading">Programs</span>
          <Link href="/courses">Courses</Link>
          <Link href="/tef-tcf">TEF / TCF</Link>
          <Link href="/delf">DELF</Link>
          <Link href="/find-your-batch">Find your batch</Link>
          <Link href="/le-hub">Le Hub</Link>
        </div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/courses/page.tsx components/Navigation.tsx components/Footer.tsx
git commit -m "feat: add /courses page and link it from nav + footer"
```

---

### Task 14: End-to-end manual QA

**Files:** none (verification only).

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds with no type/lint errors.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev` (background), then open `http://localhost:3000/courses` in the browser.

- [ ] **Step 3: Walk the golden path**

1. Confirm the hero, filter chips, and card grid render with the site's existing look (serif headings, bordeaux/blue accents, no layout shift).
2. Click each filter chip — confirm the grid updates instantly (no reload), "DELF" filter shows only the pricing matrix, "Orientation" shows only the orientation card, "All" shows everything.
3. Click **View Details** on a card (e.g. B1 French Course) — confirm the modal opens with Overview / What You'll Learn / Course Includes, Escape closes it, clicking the backdrop closes it.
4. From the details modal, click **Enroll Now →** — confirm it closes the details modal and opens the enroll form with **B1 French Course · ₹25,000** in the summary box.
5. Submit the form with an invalid email (e.g. `test`) — confirm an inline error appears under the Email field and the form does not proceed (no browser `alert()`).
6. Fill valid Name/Email/Phone, submit — confirm it advances to the **Complete Your Enrollment** payment screen showing the student name and fee.
7. Click **Pay Now** — confirm the Razorpay checkout opens (test mode). Complete a test payment using Razorpay's documented test card/UPI flow.
8. Confirm the modal shows **Enrollment Successful 🎉** with the correct course, name, and amount paid, and that **Back to Courses** and **Contact The Français Hub** both work.
9. Repeat steps 4–7 but dismiss the Razorpay checkout instead of paying — confirm the **Payment Unsuccessful** screen appears with working **Try Again** and **Back to Enrollment** buttons.
10. From the DELF matrix, click **Enroll** under DELF B2 → Speaking — confirm the enroll form's summary shows **DELF B2 Speaking Preparation · ₹13,500**.
11. From the Orientation Test card, select **B2**, click Enroll — confirm the summary shows **French Orientation Test — B2 · ₹400**.
12. Resize the browser to ~390px width — confirm no horizontal scrollbar anywhere on the page, the DELF matrix reflows to stacked cards with visible Speaking/Writing/Speaking+Writing labels, and the enroll form remains usable.
13. Confirm `/`, `/tef-tcf`, `/delf`, `/find-your-batch` still work exactly as before (spot-check each loads and its existing enroll flow — via **Find your batch** — still opens the original `EnrollModal`, unaffected).

- [ ] **Step 4: Check the Supabase tables**

Via the Supabase dashboard (or the `supabase` skill), confirm the test enrollments from Step 3 produced rows in `course_leads` and `course_payments` with the expected `product_id`/`product_title`/`amount`/`status` values, and that `public.leads`/`public.payments`/`public.students` are unaffected.

- [ ] **Step 5: Stop the dev server**

Stop the background `npm run dev` process.

---

## Self-review notes

- **Spec coverage:** §3 data model → Task 1–2; §4 pages/routing → Task 13; §5 components → Tasks 7–12; §6 payment integration → Tasks 4–6, 11; §7 database → Task 2; §8 styling → Tasks 7, 9, 10, 8/11 (module CSS); §9 accessibility (Escape, `role="dialog"`, `aria-pressed`, no color-only meaning) → Tasks 8, 11, 12; §10 out-of-scope items → respected throughout (no task touches `BatchFinder`/`EnrollModal`/batch types/admin).
- **Type consistency verified:** `Enrollable` (Task 1) is consumed identically in `CourseCatalog.tsx` (Task 12), `CourseEnrollModal.tsx` (Task 11), and `coursePayment.ts`/API routes (Tasks 4–6) — `enrollableProductId`/`enrollableTitle`/`enrollablePriceInPaise` signatures match their definitions exactly everywhere they're called. `CourseLead`/`CoursePayment` field names match their Supabase row mappers and the API routes that construct them.
- **No duplicate B2:** confirmed only one `b2-french` entry in Task 1's `courses` array.
