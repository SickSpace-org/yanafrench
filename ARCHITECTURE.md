# Architecture Analysis — The Français Hub (v1)

Repository: `yanafrench` (root: `WORING/YANA FRENCH`)
Analysis date: 2026-09-07 — read-only inspection, no files modified.

---

## 1. Technology Stack

### Language & runtime
- **TypeScript** (`strict: true`) — the only source language; `allowJs: false` in `tsconfig.json`. No `.js` source files.
- **Node.js** runtime, via **Next.js 16.2.12** (App Router) — confirmed by `next.config.ts`, the `app/` directory shape, and `next dev` / `next build` / `next start` scripts in `package.json`.
- **React 19.2.8** / **react-dom 19.2.8**.

### Framework & rendering
- **Next.js App Router** is both the frontend framework and the backend (API routes). This is a single full-stack Next.js application, not a separate frontend/backend repo.
- No `middleware.ts` — no edge middleware/auth gate exists.

### Key libraries
| Purpose | Library |
|---|---|
| Animation | `motion` (Motion for React) 12.x |
| AI / LLM | `ai` (Vercel AI SDK) 7.x, `@ai-sdk/google` (Gemini provider), `@ai-sdk/react` (`useChat` on the client) |
| Object storage client | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` — used against **Cloudflare R2** (S3-compatible), not AWS |
| Validation | `zod` 4.x — used to constrain LLM structured outputs (`Output.object` schemas) |

### Database / ORM
- **None.** There is no SQL/NoSQL database and no ORM (no Prisma/Drizzle/Mongoose etc. in `package.json`).
- Persistence is a **single JSON document in Cloudflare R2** (`data/portal-state.json`), read/written wholesale via `lib/r2.ts`'s `readJson`/`writeJson`. A second key holds the shared message thread. This is intentionally a "poor man's database" — see §3.

### State management
- No global state library (no Redux/Zustand/Jotai). State is:
  - Local `useState`/`useMemo` in components.
  - A shared **polling hook** (`lib/usePortalState.ts`) that fetches `/api/portal-state` every 3s, applies optimistic local updates, and reconciles with the server — this is the de facto "client store" for admin-editable content (courses, batches, leads, quiz, word-of-week, etc.).
  - A near-identical polling hook for the message thread (`lib/useMessageThread.ts`).

### UI
- No component library (no MUI/Chakra/shadcn). Hand-built components styled with:
  - Global CSS (`app/globals.css`) for design tokens/utility classes.
  - **CSS Modules** (`ComponentName.module.css`) per component for scoped styles.
- `motion/react` for transitions/animation (`AnimatePresence`, `motion.div`, `useReducedMotion`).

### Testing
- **None configured.** No Jest/Vitest/Playwright/Cypress in `package.json`, no `__tests__` directories, no test scripts.

### Build tools & package manager
- **npm** (`package-lock.json` present; no `yarn.lock`/`pnpm-lock.yaml`).
- **Turbopack** — Next.js 16's default bundler/dev server (`▲ Next.js 16.2.12 (Turbopack)` on `next dev`/`next build`).
- No monorepo tool (no Turborepo/Nx/workspaces field in `package.json`) — this is a single-package repo.

### Infrastructure / deployment
- **No Docker.** No `Dockerfile`/`docker-compose.yml` anywhere in the repo.
- **No active CI/CD.** `.github/workflows/` exists but is **empty** — the `README.md` describes a GitHub Pages static-export workflow (`deploy-pages.yml`) that is referenced but not actually present in the repo (stale documentation).
- **Actual deployment is Vercel**, not GitHub Pages: `.vercel/project.json` links this repo to Vercel project `yanafrench` (team `yanafrench`). Deploys currently happen via `vercel --prod` from the CLI, plus GitHub push (repo `github.com/SickSpace-org/yanafrench`) — Vercel's Git integration should auto-deploy pushes to `main` once the project's Git connection points at the current repo.
- **External services** configured via `.env.local` / Vercel env vars:
  - `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — Cloudflare R2 (object storage + JSON "database").
  - `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini access for the AI SDK routes.
  - `VERCEL_OIDC_TOKEN` — Vercel-injected, used for Vercel-native integrations if any are added later.

---

## 2. Frontend vs. Backend Boundaries

This is a **single Next.js App Router project** — frontend and backend live in the same repo and the same route tree, not in separate directories or packages.

- **Frontend** (pages, layouts, UI): `app/**/page.tsx`, `app/layout.tsx`, and all of `components/`.
  - Public marketing site: `app/page.tsx`, `app/about`, `app/tef-tcf`, `app/delf`, `app/le-hub`, `app/results`, `app/resources`, `app/resources/[slug]`, `app/find-your-batch`.
  - Student-facing app ("Student Hub"): `app/student-hub/**` (dashboard, calendar, lessons, messages, notifications, progress, settings, speaking practice + history/results, vocabulary).
  - Admin panel: `app/admin/**` (lessons manager, batches, enrollments, highlights, messages).
- **Backend** (server-only handlers): `app/api/**/route.ts` — Next.js Route Handlers. Every backend endpoint lives under `app/api/`; there is no separate Express/Fastify/Nest server anywhere.
- **Client vs. server code inside `app/`**: Next.js's own convention governs this — a file is a Server Component by default; any component needing hooks/state/browser APIs is explicitly marked `"use client"` at the top (e.g. `components/Navigation.tsx`, `components/BatchFinder.tsx`, `components/usePortalState.ts`'s consumers). `app/layout.tsx` and most `page.tsx` files are plain (server) wrappers that import client components.

### Shared code
- **`lib/`** is the shared layer between frontend and backend, but it's carefully split to avoid leaking server-only code into the browser bundle:
  - **Types/contracts shared both ways**: `lib/batchData.ts` (`Batch`, `BatchCourse`, `BatchStatus`), `lib/leadData.ts` (`Lead`), `lib/portalState.ts` (`PortalState`, `PortalStateAction` — the full admin-content shape and its reducer). These are imported by both client components and API routes.
  - **Server-only split-out on purpose**: `lib/portalStateServer.ts` exists *only* to keep `lib/r2.ts`'s AWS SDK import out of the client bundle — `lib/portalState.ts` (imported by the client hook) has zero AWS SDK dependency; `lib/portalStateServer.ts` (imported only by route handlers) does the actual R2 read. This is the one clear "shared code" architectural decision documented in-repo (see comment at the top of `lib/portalStateServer.ts`).
  - **Client-only hooks**: `lib/usePortalState.ts`, `lib/useMessageThread.ts`, `lib/useAdminValue.ts` (all `"use client"`).
- There is no generated API client, no OpenAPI/GraphQL schema, and no tRPC — the "contract" between client and server is just the shared TypeScript types above, called via plain `fetch`.

---

## 3. System Architecture & Communication

### Protocol
**Plain REST-ish JSON over HTTP `fetch`** — no GraphQL, no gRPC, no WebSockets. "Live" updates are simulated via **client-side polling** (3-second intervals), not push/subscriptions.

### API routes (all under `app/api/`)
| Route | Method(s) | Purpose |
|---|---|---|
| `/api/portal-state` | GET, POST | Single source of truth for almost all admin-editable content (courses, recordings, resources, quiz level/sessions, word-of-week, teacher note, batches, leads). GET returns the whole document; POST takes a typed `PortalStateAction`, applies it via a pure reducer, and persists the result to R2. |
| `/api/messages` | GET, POST (implied by `useMessageThread`) | Shared student↔teacher chat thread, persisted separately in R2. |
| `/api/chat` | POST | AI concierge chat — streams a Gemini response (`streamText` + `createUIMessageStreamResponse`) grounded in static site content (`lib/data.ts`); consumed by `components/ChatWidget.tsx` via `@ai-sdk/react`'s `useChat`. |
| `/api/quiz/generate`, `/api/quiz/submit` | POST | AI-generated quiz questions + AI grading, with a daily-limit token scheme; results appended into `PortalState.quizSessions`. |
| `/api/speaking/evaluate` | POST | Uploads a student's spoken-French audio (FormData) for AI evaluation. |
| `/api/enhance-text`, `/api/word-of-week`, `/api/teacher-note` | POST | Small AI-assist endpoints for the admin panel (rewrite a title/description, generate a "word of the week", generate a teacher note). |
| `/api/upload` | POST | Returns a presigned R2 PUT URL so a file uploads browser→R2 directly (bypasses Vercel's request body size limit). |
| `/api/video-upload/{start,part-url,complete,abort}` | POST | Multipart upload protocol for large video files, same direct-to-R2 pattern, chunked so a failed chunk can retry without restarting the whole upload. |
| `/api/storage/delete` | POST | Best-effort delete of an R2 object when an admin removes/replaces an uploaded file. |

### Entry points
- **Frontend entry point**: `app/layout.tsx` (root layout — wraps every route in `<AppChrome>`, which conditionally renders the marketing nav/footer/chat widget vs. the bare shell for `/student-hub/*` and `/admin/*`). Route-level entry points are each `app/**/page.tsx`.
- **Backend entry point**: there is no single server entry file — each `app/api/**/route.ts` is its own serverless function entry point, per Next.js App Router convention (deployed as individual Vercel Functions).

### Data flow (example: an admin edits a batch)
1. Admin UI (`components/admin/AdminBatchesPanel.tsx`, client component) calls `updateBatch(id, patch)` from `usePortalState()`.
2. The hook (`lib/usePortalState.ts`) optimistically applies the change locally (`applyPortalAction`) so the UI updates instantly, and fires `POST /api/portal-state` with the action `{ type: "updateBatch", id, patch }`.
3. The route handler (`app/api/portal-state/route.ts`) reads the current document from R2 (`readPortalState()` → `lib/portalStateServer.ts` → `lib/r2.ts`), applies the same pure reducer (`applyPortalAction`, shared from `lib/portalState.ts`) server-side, and writes the new document back to R2 (`writeJson`).
4. The response (the new authoritative state) reconciles the client's optimistic copy.
5. Independently, the public site (`components/BatchFinder.tsx`) and the student portal are polling `GET /api/portal-state` every 3s via their own `usePortalState()` instance, so the edit becomes visible there within a few seconds — this is how "real-time-ish" sync across devices/browsers is achieved without a database or WebSockets.

### Example: AI chat request
Browser (`ChatWidget`, via `useChat`) → `POST /api/chat` → route handler streams tokens from Gemini (`@ai-sdk/google`) via the Vercel AI SDK's `streamText` → response streamed back as a UI message stream → rendered incrementally in the widget. No persistence — this thread is not saved anywhere.

---

## 4. High-Level Directory Map

```
YANA FRENCH/
├── app/                          # Next.js App Router — every route + all backend endpoints
│   ├── layout.tsx                # Root layout — global <head>, wraps children in AppChrome
│   ├── globals.css               # Design tokens (colors, spacing, shadows) + shared utility classes
│   ├── page.tsx                  # Public homepage
│   ├── about/, tef-tcf/, delf/, le-hub/, results/, resources/, find-your-batch/
│   │                             # Public marketing pages (server components importing client sections)
│   ├── student-hub/              # Student-facing app (dashboard, calendar, lessons, messages,
│   │                             # notifications, progress, settings, speaking practice, vocabulary)
│   ├── admin/                    # Admin panel (lessons manager, batches, enrollments, highlights, messages)
│   └── api/                      # BACKEND — Route Handlers (one folder = one endpoint)
│       ├── portal-state/         # GET/POST — the shared admin-content document (courses, batches, leads, quiz, etc.)
│       ├── messages/             # Shared student↔teacher chat thread (R2-persisted)
│       ├── chat/                 # AI concierge chat (Gemini, streamed)
│       ├── quiz/generate|submit/ # AI quiz generation + AI grading
│       ├── speaking/evaluate/    # AI evaluation of uploaded spoken-French audio
│       ├── enhance-text/, word-of-week/, teacher-note/   # Small AI-assist endpoints for admin
│       ├── upload/                       # Presigned direct-to-R2 upload (small files)
│       ├── video-upload/{start,part-url,complete,abort}/ # Chunked multipart upload for video
│       └── storage/delete/       # Deletes an R2 object when admin removes/replaces a file
│
├── components/                   # All React components (mostly "use client")
│   ├── admin/                    # Admin-only panels (AdminBatchesPanel, AdminLeadsPanel, AdminQuizPanel, ...)
│   ├── *.module.css              # Per-component scoped styles, paired 1:1 with same-named .tsx
│   └── *.tsx                     # Public-site sections, student-hub pages, shared widgets (Navigation,
│                                  # ChatWidget, EnrollModal, BatchFinder, CalendarPage, etc.)
│
├── lib/                          # Shared logic — types, data, hooks, server utilities
│   ├── batchData.ts              # Batch type + day/time formatting + calendar-event generation
│   ├── leadData.ts               # Lead (enrollment inquiry) type
│   ├── portalState.ts            # PortalState type + its action-based reducer (SHARED client+server)
│   ├── portalStateServer.ts      # Server-only wrapper around portalState — isolates the R2/AWS SDK
│   │                              # import so it never reaches the client bundle
│   ├── usePortalState.ts         # Client hook: polls /api/portal-state, optimistic updates ("use client")
│   ├── useMessageThread.ts       # Client hook: polls /api/messages ("use client")
│   ├── r2.ts                     # Server-only Cloudflare R2 (S3-compatible) client — the persistence layer
│   ├── speakingEval.ts           # AI speaking-evaluation logic used by the API route
│   ├── quizData.ts, courseData.ts, courseCatalog.ts, recordingData.ts, resourceData.ts,
│   │   vocabData.ts, progressData.ts, profileData.ts, notificationData.ts, messageData.ts,
│   │   data.ts, adminEvents.ts   # Static/seed content + domain types for each feature area
│   └── uploadFile.ts, uploadVideoR2.ts, dropFiles.ts, deleteFile.ts
│                                  # Client-side upload helpers calling the /api/upload* routes
│
├── public/                       # Static assets (favicon, hero/lifestyle images, result screenshots, robots.txt)
│
├── .vercel/                       # Vercel project link (project.json → project "yanafrench")
├── .github/workflows/             # Present but empty — README references a GitHub Pages workflow
│                                  # that does not actually exist in this repo (stale docs)
├── .env.local                     # R2 + Gemini credentials (not committed logic-wise, present locally)
├── next.config.ts                 # Next.js config — currently empty/default
├── tsconfig.json                  # TypeScript config — strict mode, "@/*" path alias to repo root
├── package.json / package-lock.json
├── README.md                      # Project README (partially stale re: deployment target)
└── CHANGES.md                     # Running changelog
```

---

## Notable architectural observations

- **No database, by design** — a single JSON blob in R2 serves as the entire "database" for admin content, read/written wholesale on every request. This is simple and works at current scale (one student, one admin) but doesn't scale to concurrent multi-writer scenarios beyond the app's own optimistic-merge logic (`lib/usePortalState.ts`'s `pendingRef` replay mechanism handles the single-admin case, not concurrent admins).
- **"Real-time" is polling, not push** — every live-feeling surface (batches, messages, admin edits) is a 3-second `setInterval` fetch loop, not WebSockets/SSE for state sync (SSE-style streaming *is* used, but only for one-shot AI responses in `/api/chat`, not for state sync).
- **Deployment docs are out of date** — `README.md` describes a GitHub Pages static-export flow that no longer reflects reality; the project is actually deployed to Vercel via the CLI and (intended) Git auto-deploy.
- **No authentication anywhere** — `/admin/**` and `/student-hub/**` are reachable by anyone with the URL; there's no middleware, session, or login gate in the codebase.
