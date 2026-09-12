# Courses Section & Enrollment/Payment Flow — Design

Status: approved by user 2026-09-10. Implementation to follow via writing-plans.

## 1. Goal

Add a premium, filterable Courses catalog to the public site (`/courses`) where a
visitor can browse programs, view full details, enroll, and pay — reusing the
site's existing visual language and Razorpay integration pattern, without
touching the existing batch-seat enrollment system (`BatchFinder` /
`EnrollModal` / `/api/payment/*`).

## 2. Context established during inspection

- Stack: Next.js 16 App Router, React 19, TypeScript strict, CSS Modules +
  global design tokens (`app/globals.css`), `motion/react` for animation,
  Supabase Postgres (service-role only, RLS enabled no policies) for
  leads/payments/students, Cloudflare R2 for the admin "portal state" JSON
  (batches, courses-as-lessons, etc.), Razorpay already integrated
  end-to-end (order creation + HMAC verification), currently on a **test**
  key (`rzp_test_…`).
- The existing enrollment flow (`components/EnrollModal.tsx`,
  `app/api/payment/create-order`, `app/api/payment/verify`) is scoped to
  **batches**: `Batch`/`BatchCourse` ("TEF"|"TCF"|"DELF"), `Lead`, `Payment`,
  `Student` — all keyed to a scheduled cohort with seats. It deliberately
  charges a flat ₹1 "test payment" regardless of the real fee (see comments
  in `EnrollModal.tsx` and `app/api/payment/create-order/route.ts`).
  `BatchCourse` is used in 10 files (`BatchFinder.tsx`, `CalendarPage.tsx`,
  `AdminBatchesPanel.tsx`, etc.) — widening it for the new catalog would
  ripple into unrelated admin/calendar code, so this design keeps the new
  system fully isolated instead.
- `lib/courseCatalog.ts` / `lib/courseData.ts` are **unrelated** existing
  files — they back the Student Hub's video-lesson catalog, not a
  sales/pricing catalog. New files use different names to avoid confusion.
- `app/tef-tcf`, `app/delf` are marketing-only pages (no pricing) and are
  left untouched. `app/find-your-batch` (`BatchFinder`) is left untouched.
- Design tokens already fit an "elegant academic French" brief: `--porcelain`
  (warm ivory), `--blue`/`--blue-2` (deep navy accent), `--bordeaux` (French
  red accent), `--serif` (Instrument Serif headings) / `--sans` (Manrope
  body), `--card-surface`, `--r-sm/md/lg/xl`, `--shadow-soft/lift/glow`,
  pill `.button` variants, `.eyebrow` badges. The existing
  `.resource-catalog` (filter chips) + `.resource-card` (price/level card)
  + `.resource-detail` (price + facts + "inside" list + purchase panel)
  patterns are near-exact prior art for this feature and are reused/extended
  rather than reinvented.
- User decisions (via clarifying questions): checkout charges the **real
  course fee** (safe — Razorpay is in test mode, no real money moves until a
  live key is configured); **no new admin UI** in this pass — new Supabase
  tables are isolated from the batch system, visible via the Supabase
  dashboard for now.

## 3. Data model

New file `lib/courseCatalogData.ts` — static, hand-edited catalog (same
philosophy as `lib/data.ts`'s `resources`: a plain exported array, no admin
CRUD).

```ts
export type CourseCategory = "French Levels" | "TEF" | "TCF" | "DELF" | "Orientation";

export type Course = {
  id: string;                 // slug, e.g. "b1-french"
  category: CourseCategory;
  title: string;               // "B1 French Course"
  badge?: "Popular" | "Fast Track" | "Exam Prep" | "CLB 7+"; // sparingly
  level?: string;               // "Intermediate" | "B1" | etc — display only
  minimumLevel?: string;        // "B1–B2" (TEF/TCF)
  description: string;          // 1–2 sentence card summary
  overview: string;             // longer modal paragraph
  duration: string;             // "50 classes" | "6–7 months"
  maxDuration?: string;         // "8 months"
  classes?: number;             // 50, 60, 90 — for display + summary line
  mode: string;                 // "Live online"
  priceInPaise: number;
  regularPriceInPaise?: number;
  savingsInPaise?: number;
  whatYouLearn: string[];       // Listening/Speaking/Reading/Writing/Grammar/Vocabulary/Practice
  includes: string[];           // "Course Includes" bullets
  target?: string;              // outcome/target blurb (TEF/TCF)
};

export const courses: Course[] = [ /* 10 entries: TEF CLB5, TEF CLB7+, TCF CLB5,
  TCF CLB7+, A1, A2, A1+A2, B1, B2 (single, de-duplicated), C1 */ ];

export type DelfOption = { kind: "speaking" | "writing" | "speakingWriting"; label: string; priceInPaise: number; sessions: number; };
export type DelfCourse = { id: string; level: "A1"|"A2"|"B1"|"B2"|"C1"; options: DelfOption[]; };
export const delfCourses: DelfCourse[] = [ /* A1..C1, 3 options each */ ];

export type OrientationLevel = { level: "A1"|"A2"|"B1"|"B2"; priceInPaise: number; };
export const orientationLevels: OrientationLevel[] = [ /* A1 150, A2 200, B1 300, B2 400 */ ];

// Discriminated union the enroll/payment components accept so one flow
// handles a plain Course, a DELF option, or an Orientation level:
export type Enrollable =
  | { kind: "course"; course: Course }
  | { kind: "delf"; delfLevel: DelfCourse["level"]; option: DelfOption }
  | { kind: "orientation"; level: OrientationLevel };

export function enrollableTitle(e: Enrollable): string { /* e.g. "DELF B2 Speaking Preparation" */ }
export function enrollablePriceInPaise(e: Enrollable): number { /* … */ }
export function enrollableProductId(e: Enrollable): string { /* stable id used server-side to re-derive price */ }
```

All prices are corrected from the brief's rupee figures to paise (×100) at
the data layer, matching the existing `Payment.amount`/paise convention.
`enrollableProductId` + a server-side lookup table (mirrors this file) is
what `create-order` uses to price the order — **the client-submitted amount
is never trusted**, consistent with the existing `create-order/route.ts`.

## 4. Pages & routing

- `app/courses/page.tsx` — new route, `<PageHero>` (reusing the existing
  component) + `<CourseCatalog />`. Metadata: title "Courses", description
  matching the site's SEO style.
- `components/Navigation.tsx` — add `["Courses", "/courses"]` to the `links`
  array (after "Programs"), and to the mobile menu (same array, no separate
  edit needed since mobile reads the same `links`).
- `components/Footer.tsx` — add a "Courses" link in the relevant column if a
  programs/links column already exists (inspect at implementation time;
  don't restructure the footer if it doesn't fit cleanly).

## 5. Components (new)

All under `components/`, each with a paired `.module.css` except where a
class already exists in `globals.css` and is extended in place (the
catalog/grid/filter chrome follows the `resource-catalog`/`resource-card`
precedent closely enough that some of this may live in `globals.css`
alongside those rules rather than a module — decided at implementation time
per the existing file's own convention).

- **`CourseCatalog.tsx`** — client component. Filter chips (All / French
  Levels / TEF / TCF / DELF / Orientation), a responsive card grid for
  `courses`, a dedicated DELF pricing matrix section, and an Orientation
  Test card. Holds `selectedEnrollable` / `detailsCourse` state and mounts
  `CourseDetailsModal` + `CourseEnrollModal` conditionally (`AnimatePresence`,
  matching `EnrollModal`'s pattern).
- **`CourseCard.tsx`** — presentational. Category label, title, 1–2 line
  description, level/duration/classes/mode row, price (+ struck-through
  regular price and "Save ₹X" when `savingsInPaise` is set), badge (sparingly),
  View Details + Enroll Now buttons.
- **`CourseDetailsModal.tsx`** — full detail modal/drawer (full-screen sheet
  on mobile). Title, category, level, duration, classes, fee, mode, Overview,
  "What You'll Learn" list, "Course Includes" list, target/outcome where
  present, Enroll Now CTA that hands off to `CourseEnrollModal` with the
  course pre-selected.
- **`DelfPricingTable.tsx`** — the DELF A1–C1 matrix (Course | Speaking |
  Writing | Speaking + Writing), each cell showing price + session count
  with its own Enroll button feeding `enrollableTitle`/price straight into
  the enroll flow.
- **`OrientationTestCard.tsx`** — small card, four selectable levels
  (A1–B2), Enroll per level.
- **`CourseEnrollModal.tsx`** — the enrollment→payment flow, structurally a
  generalized `EnrollModal.tsx`: same phase machine
  (`form → processing → paid → payment_failed`), same
  nav-hiding-while-open trick, same inline-validation-not-alerts approach,
  but:
  - accepts an `Enrollable` (course pre-filled, not re-selectable when
    launched from a specific card/option — a `<select>` of all courses only
    when opened generically, e.g. a bare "Enroll" entry point if one exists)
  - fields: Full Name*, Email*, Phone*, WhatsApp Number, Current French
    Level (reuses `CURRENT_LEVELS` from `lib/leadData.ts` — pure constant,
    no coupling to the `Lead` type itself), Preferred Learning Mode,
    Message
  - inline validation: required-field + email regex + phone length/format
    checks before allowing submit (no `alert()`); reuses the existing
    `sanitizePhone` approach from `EnrollModal.tsx` (copied, not imported,
    since it's a small pure function and the two modals stay decoupled)
  - shows a "Selected Course" + "Course Fee" summary before "Continue to
    Payment"
  - payment screen: course, student name, fee, secure-payment note, Pay Now
    (opens Razorpay via `lib/coursePayment.ts`)
  - success: "Enrollment Successful 🎉", course/name/amount paid, "Back to
    Courses" (closes modal) + "Contact The Français Hub" (existing WhatsApp
    link component)
  - failure: "Payment Unsuccessful", Try Again (retries the same order
    flow) / Back to Enrollment (returns to the form, values preserved)

## 6. Payment integration (isolated from the batch system)

- **`lib/coursePayment.ts`** — the explicit gateway boundary the brief asks
  for:
  ```ts
  // createCourseOrder: POSTs to /api/course-payment/create-order. The
  // server re-derives the price from courseCatalogData by productId — the
  // amount here is never trusted, only used for the receipt label.
  export async function createCourseOrder(input: {...}): Promise<{ orderId, amount, currency }>

  // openCourseCheckout: loads the Razorpay script (reuses
  // lib/loadRazorpayScript.ts) and opens window.Razorpay with the given
  // order + prefill + handler/ondismiss callbacks.
  //
  // WHERE TO WIRE A LIVE GATEWAY: this project already has a real Razorpay
  // integration (see app/api/payment/create-order, app/api/payment/verify)
  // on a TEST key (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET /
  // NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.local + Vercel). To go live, swap
  // those three env vars for live-mode values — no code change needed here.
  export function openCourseCheckout(order, details, handlers): void
  ```
- **`app/api/course-leads/route.ts`** — POST, persists the enrollment
  inquiry to `course_leads` before payment opens (mirrors leads capture
  happening before payment in the batch flow).
- **`app/api/course-payment/create-order/route.ts`** — POST, looks up the
  price server-side from `courseCatalogData` via `productId`, creates the
  Razorpay order (same REST call shape as the existing route), records a
  `course_payments` row with status `"created"`.
- **`app/api/course-payment/verify/route.ts`** — POST, same HMAC
  (`createHmac("sha256", RAZORPAY_KEY_SECRET)`) + `timingSafeEqual`
  verification as the existing route, patches `course_payments` to
  `"paid"`/`"failed"`, patches `course_leads.payment_status`. No student/seat
  side effects (there's no seat concept for these products).
- No secrets in frontend code; `RAZORPAY_KEY_SECRET` stays server-only,
  exactly as today. `NEXT_PUBLIC_RAZORPAY_KEY_ID` (public by design) is the
  only Razorpay value read client-side.

## 7. Database

New migration `supabase/migrations/<timestamp>_create_course_leads_payments.sql`,
following the existing migration's exact conventions (RLS enabled, no
policies, service-role-only access, `grant` kept for Data API exposure):

```sql
create table if not exists public.course_leads (
  id text primary key,
  name text not null,
  phone text not null,
  email text not null,
  whatsapp text,
  product_id text not null,       -- Enrollable id, e.g. "delf-b2-speaking"
  product_title text not null,    -- "DELF B2 Speaking Preparation"
  current_level text,
  preferred_mode text,
  message text,
  payment_status text,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.course_payments (
  id text primary key,            -- Razorpay order id
  lead_id text not null,
  name text not null,
  email text not null,
  phone text not null,
  product_id text not null,
  product_title text not null,
  amount integer not null,        -- paise
  currency text not null,
  status text not null,           -- created | paid | failed
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
```

Plus indexes/RLS/grants mirroring the existing migration file 1:1.
`lib/courseLeadData.ts`, `lib/coursePaymentData.ts` provide the
row⇄domain mappers, same shape as `leadData.ts`/`paymentData.ts`.

## 8. Styling

No new design system. New CSS either extends `app/globals.css` (if it's
squarely in the vein of `.resource-catalog`/`.resource-card`/
`.resource-detail`) or lives in per-component `.module.css` files (for the
modals, following `EnrollModal.module.css`'s conventions exactly: same
backdrop blur, `--r-lg` card, pill `.submit`/`.secondary` buttons, same
`--stone` input borders, same focus rings). Badges reuse the `.eyebrow`
treatment. The DELF matrix gets its own compact styling (not a generic
card) — a real table on desktop that reflows to stacked cards under the
`800px` breakpoint already used throughout `globals.css`, so it never
overflows horizontally on mobile.

Animations: `motion/react` `AnimatePresence` for modal mount/unmount (same
timing as `EnrollModal`: opacity+y+scale, `duration: .25`), `Reveal` for
scroll-in card entrance (existing component), all respecting
`prefers-reduced-motion` via the global rule already in `globals.css`.

## 9. Accessibility

Modals: `role="dialog"` `aria-modal="true"` `aria-label`, focus trap +
Escape-to-close (add a shared `useEffect` keydown handler — `EnrollModal`
currently only closes via backdrop/×, so this is a small addition, applied
to both new modals), visible focus states (existing `:focus-visible` rule
covers new interactive elements automatically since they reuse `.button`/
form input patterns). Filter chips use `role="group"` +
`aria-pressed`, matching `ResourceCatalog.tsx`. Price/savings badges carry
text, not color-only meaning.

## 10. Explicitly out of scope

- No changes to `BatchFinder.tsx`, `EnrollModal.tsx`, `/api/payment/*`,
  `Batch`/`BatchCourse`/`Lead`/`Payment`/`Student` types, or any admin panel.
- No new admin UI for `course_leads`/`course_payments` in this pass.
- No changes to `/tef-tcf`, `/delf`, `/find-your-batch`.
- No live Razorpay credentials — stays on the existing test key until the
  user swaps env vars.

## 11. File summary

**New:**
`lib/courseCatalogData.ts`, `lib/courseLeadData.ts`, `lib/coursePaymentData.ts`,
`lib/coursePayment.ts`,
`app/courses/page.tsx`,
`app/api/course-leads/route.ts`,
`app/api/course-payment/create-order/route.ts`,
`app/api/course-payment/verify/route.ts`,
`components/CourseCatalog.tsx` (+ `.module.css` if needed),
`components/CourseCard.tsx`,
`components/CourseDetailsModal.tsx` (+ `.module.css`),
`components/DelfPricingTable.tsx` (+ `.module.css`),
`components/OrientationTestCard.tsx`,
`components/CourseEnrollModal.tsx` (+ `.module.css`),
`supabase/migrations/<timestamp>_create_course_leads_payments.sql`.

**Modified:**
`components/Navigation.tsx` (nav link), `components/Footer.tsx` (footer
link, if it fits), possibly `app/globals.css` (new section-level classes,
additive only).
