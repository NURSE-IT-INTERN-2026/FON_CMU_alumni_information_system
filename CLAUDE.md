# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Alumni Information System for the Faculty of Nursing, Chiang Mai University (FON CMU). Full product requirements are in `PRD.md`. UI reference screenshots are in `reference/`. Tech stack details in `TECH_STACK.md`.

## Commands

```bash
npm run dev               # Start dev server (http://localhost:3000)
npm run build             # Production build
npm run lint              # ESLint
npm run test              # Run vitest once
npm run test:watch        # Run vitest in watch mode
npx prisma migrate dev    # Run migrations (requires DATABASE_URL in .env)
npx prisma generate       # Regenerate Prisma client after schema changes
npx prisma studio         # Database browser
npx tsx prisma/seed.ts    # Run database seed script
```

## Architecture

### Core Stack

- **Next.js 16.2** with App Router (`app/` directory). This version has breaking changes from earlier Next.js — read the relevant guide in `node_modules/next/dist/docs/` before writing code.
- **React 19.2** with server and client components.
- **Prisma 7** ORM with PostgreSQL. Schema at `prisma/schema.prisma`. Client generates to `app/generated/prisma/` (import from there, not `@prisma/client`).
- **Prisma PostgreSQL adapter** (`@prisma/adapter-pg`) — the Prisma client is initialized with the `PrismaPg` adapter in `lib/prisma.ts`, using `DATABASE_URL` from `.env`.
- **Tailwind CSS 4** with PostCSS plugin (`@tailwindcss/postcss`). CSS-first configuration in `app/globals.css` — no `tailwind.config.js`. Uses `@theme inline` block for custom theme colors (primary: `#1e3a5f` dark blue, accent: `#e8a838` gold).
- **Vitest 4** for testing. Config at `vitest.config.ts`. Tests in `tests/`.
- **Path alias:** `@/*` maps to project root.

### Prisma Client Import Pattern

```ts
import prisma from "@/lib/prisma";
```

The singleton pattern in `lib/prisma.ts` prevents multiple client instances during hot reload. The client is imported from `../app/generated/prisma/client`, **not** `@prisma/client`.

### Database Schema

14 models in `prisma/schema.prisma` (table names from `@@map`):

| Model | Table | Purpose |
|---|---|---|
| `Alumni` | `alumni` | Core alumni records (`studentId` unique, `prefix`/`firstName`/`lastName`, `degreeLevel`, `cohort`, `email`/`phone`/`homeAddress`). **Single `lastName`** (merged from the old `maidenLastName`+`newLastName`). Carries a denormalized **primary** degree snapshot + `primaryEducationId` (see `Education`). `currentWorkplace`/`country`/`province` and the old `maidenLastName`/`newLastName` were REMOVED |
| `Education` | `education` | One row per degree an alumni earned (`studentId` unique, `degreeLevel`, `graduationYear`, `major`, `cohort`, `firstName`/`lastName` = ชื่อ/นามสกุล ขณะศึกษา); `@@unique([alumniId, degreeLevel])`. 1:N with `Alumni`; `Alumni.primaryEducationId` points at the primary row whose fields are mirrored onto the `Alumni` snapshot |
| `Award` | `awards` | Awards linked to alumni — split name (`prefix`/`firstName`/`lastName`), `awardType` enum, Buddhist `year`, `link`/`imageUrl` (no legacy `recipientName`) |
| `Association` | `associations` | Professional associations/positions |
| `GraduateCommittee` | `graduate_committees` | Committee memberships |
| `Potential` | `potentials` | Notable alumni potentials |
| `ModelRepresentative` | `model_representatives` | Model representative entries |
| `AlumniAgency` | `alumni_agency` | Alumni agency (Thailand + Abroad toggle) — renamed from `AbroadAlumni` |
| `News` | `news` | News articles (status, rich-text body, cover + up to 4 images) |
| `AdminUser` | `admin_users` | System users with roles |
| `ActivityLog` | `activity_logs` | Audit trail (JSON details) |
| `FieldChangeHistory` | `field_change_history` | Per-field old/new history — drives the orange update indicators (singular table) |
| `PasswordReset` | `password_resets` | Alumni password-reset tokens |
| `Session` | `sessions` | Browser sessions (token-based, `ADMIN` or `ALUMNI`) |

**Enums:**
- `DegreeLevel`: DOCTORAL, MASTER, BACHELOR, ASSOCIATE, NURSING_ASSISTANT
- `AwardType`: INTERNATIONAL, NATIONAL, LOCAL
- `NewsStatus`: DRAFT, PUBLISHED, DISCONTINUED
- `SessionType`: ADMIN, ALUMNI
- `ActorType`: ADMIN, ALUMNI

### Auth & Roles

- **Session-based auth** using `bcryptjs` + HTTP-only cookies (`fon-cmu-session`). Session tokens stored in `Session` model, 7-day expiry.
- **CMU OAuth2** with PKCE via Microsoft Entra ID (`lib/oauth.ts`). Callback at `/api/auth/callback/` (route `app/api/auth/callback/route.ts`; the registered redirect URI is the `CALLBACK_URL` env var, which both the authorize request and the token exchange read).
- **2 Roles:** `superadmin` (full CRUD + user management), `admin` (CRUD + import/export).
- **Alumni portal** (`/graduates/*`): separate self-service session flow — email/password login, identity-verification sign-up, first-login TOS acceptance. Reuses the `Session` model with `sessionType: ALUMNI`; auth routes under `app/api/alumni-auth/`.
- **Role context:** `lib/role-context.tsx` provides `useRole()`, `useCanWrite()`, `useIsAdmin()` hooks.
- **Write permission check:** `lib/permissions.ts` — `checkWritePermission()` returns 401/403 for unauthorized requests.
- **Rate limiting:** `lib/rate-limit.ts` — in-memory sliding-window (5 attempts / 15 min).
- **Auth middleware via `proxy.ts`** (Next.js 16 renamed middleware to proxy) — enforces CSP headers and redirects unauthenticated users. Also enforced at the layout level: `app/(admin)/layout.tsx` guards the admin area; `app/graduates/(authed)/layout.tsx` guards the alumni portal.

### Route Structure

```
app/
├── layout.tsx                    # Root layout (fonts, <html lang="th">)
├── page.tsx                      # Root landing page
├── login/page.tsx                # Admin login (CMU OAuth / email–password testing)
├── news/[id]/page.tsx            # News detail (public)
├── (admin)/                      # Route group — admin area (auth-guarded)
│   ├── layout.tsx                # Admin auth guard + Header/Sidebar/Footer + RoleProvider
│   └── management/               # All admin data pages
│       ├── page.tsx
│       ├── dashboard/            # Dashboard (charts, count cards, latest news)
│       ├── all-alumni/           # All-alumni table
│       ├── new-alumni/           # Alumni creation (full-form with related records)
│       ├── alumni/[id]/          # Admin alumni profile VIEW — orange edit-history, edit mode, data-logs toggle (param = UUID or studentId)
│       ├── alumni-agency/        # Thailand/Abroad toggle table
│       ├── associations/
│       ├── graduate-committee/
│       ├── model-representatives/
│       ├── awards/
│       ├── potentials/
│       ├── news/                 # News management (cards, not a table)
│       └── settings/{profile,users,logs,trash}/
├── admin/{alumni,news,users}/    # Admin-side views (verify purpose before editing)
├── graduates/                    # Alumni ("graduates") portal
│   ├── layout.tsx
│   ├── {signup,forgot-password,reset-password,tos}/
│   └── (authed)/                 # Auth-guarded alumni pages
│       ├── layout.tsx            # Alumni auth guard
│       ├── profile/              # Alumni self-profile (view/edit)
│       └── news/ + news/[id]/    # Alumni news (read-only)
├── api/                          # REST API routes
│   ├── alumni/                   # CRUD + import/export/bulk-delete + create-with-related + update-with-related/[id] + [id]/activity (merged change timeline; [id] GET resolves UUID or studentId)
│   ├── alumni-agency/            # CRUD + import/export/bulk-delete (renamed from abroad-alumni)
│   ├── alumni-accounts/[id]/     # Admin alumni-account mgmt (+ /suspend)
│   ├── alumni-auth/              # signup, login-email, forgot/reset-password, accept-tos, logout
│   ├── alumni-profile/           # Logged-in alumni's own profile (GET/PUT) + /educations (GET/POST — alumni-self education records)
│   ├── alumni-count/             # Dashboard aggregation
│   ├── associations/ · awards/ · graduate-committee/ · model-representatives/ · potentials/  # CRUD + import/export/bulk-delete
│   ├── news/                     # CRUD + bulk-delete (delete → DISCONTINUED)
│   ├── auth/{login,cmu-login,logout,callback,cleanup}/   # callback = CMU OAuth callback (Microsoft Entra ID PKCE)
│   ├── educations/[id]/          # Education record GET/PUT/DELETE (admin OR owning alumni; PUT of the primary re-syncs the Alumni snapshot)
│   ├── alumni/[id]/educations/   # Admin: list + add an alumni's education records
│   ├── cmu-alumni/               # CMU Registrar list/search proxy (GET only) + /lookup?studentId=&alumniId= (GET — single-record auto-fill preview for the add-education form; returns samePersonWarning when alumniId is a different person)
│   ├── users/[id]/               # User management
│   ├── trash/{restore,hard-delete}/   # Superadmin soft-delete recovery
│   ├── field-changes/ · filter-facets/ · dashboard/ · logs/   # logs = read-only GET + superadmin-only bulk-delete
│   └── upload/                   # Image upload (PNG/JPG, max 5 MB)
```

### API Route Pattern

Each data entity follows a consistent route structure:
- `GET /api/{entity}` — list (paginated, searchable)
- `POST /api/{entity}` — create
- `GET/PUT/DELETE /api/{entity}/[id]` — read/update/delete
- `POST /api/{entity}/import` — Excel import
- `GET /api/{entity}/export` — Excel export
- `POST /api/{entity}/bulk-delete` — bulk delete by IDs
- `POST /api/alumni/create-with-related` + `PUT /api/alumni/update-with-related/[id]` — create/update an alumni together with related records (full-form; one save can affect other pages)
- DELETE is a **soft delete**; recovery is superadmin-only via `POST /api/trash/restore` and `POST /api/trash/hard-delete`
- Every mutating route must call `checkWritePermission` (`@/lib/permissions`) and `logActivity` (`@/lib/activity-log`)
- **Standard CRUD + import/export/bulk-delete entities:** alumni, alumni-agency, associations, awards, graduate-committee, model-representatives, potentials.
- **Deviations from the standard pattern:**
  - `news` — no `import`/`export`; DELETE → `status: DISCONTINUED` (NOT a soft delete, NOT trash-recoverable).
  - `users` — no `import`/`export`/`bulk-delete`; write ops are superadmin-only (`checkSuperAdminPermission`).
  - `alumni-accounts` — admin alumni-account mgmt; uses `/[id]/suspend` instead of bulk ops (no import/export).
  - `alumni-profile` — no `/[id]`; operates on the logged-in alumni (`getAlumniSession`). GET/PUT/DELETE. `alumni-profile/educations` adds alumni-self GET/POST of education records.
  - `cmu-alumni` — read-only external Registrar proxy (GET list/search) + `lookup?studentId=&alumniId=` (single-record preview for the add-education form; with `alumniId`, returns `samePersonWarning` if the record belongs to a different person).
  - `educations` — degree records (1:N per alumni). `GET/POST /api/alumni/[id]/educations` (admin) and `GET/POST /api/alumni-profile/educations` (alumni-self) for list/add; `GET/PUT/DELETE /api/educations/[id]` for one record (admin OR owning alumni via `resolveWriter`). Every add, and a PUT that changes `studentId`, must pass `assertEducationSamePerson` (`lib/education-identity.ts`) — a studentId whose CMU birthday differs from the alumni's is rejected with 400 (can't attach a stranger's degree). No import/export/bulk-delete.
  - `logs` — otherwise read-only (GET list only). Adds a **superadmin-only** `POST /api/logs/bulk-delete` `{ ids }` that **hard-deletes** (`deleteMany`; `ActivityLog` has no `deletedAt`). Not soft-delete, not trash-recoverable, and **deliberately does NOT log the deletion** (logging it would defeat the purpose of removing log entries). UI gate on the logs page is `useRole() === "superadmin"` (NOT `useIsAdmin()`, which covers both roles).

### Route Correlations, Redirects & Entry Points

When adding/changing a route, keep this map honest (see Working Protocol "On touching routes").

**Correlations — routes that pair or overlap (touching one affects the other):**
- **Soft-delete round-trip:** `DELETE /api/{entity}/[id]` + `/api/{entity}/bulk-delete` set `deletedAt`; recoverable only via `POST /api/trash/restore` (+ permanent `POST /api/trash/hard-delete`, superadmin). **Exception:** `news` DELETE → `DISCONTINUED`, never trash-recoverable.
- **Full-form vs single CRUD:** `POST /api/alumni/create-with-related` + `PUT /api/alumni/update-with-related/[id]` write Alumni AND its 6 related entities in one transaction — overlaps `/api/alumni` POST/PUT and the per-entity routes; one save can change several pages.
- **Admin alumni profile view:** `/management/alumni/[id]` (param = alumni UUID **or** `studentId` — `GET /api/alumni/[id]` resolves either) is reached by clicking any row on the all-alumni + alumni-related tables; its data-logs tab reads `GET /api/alumni/[id]/activity` (field-change history ∪ activity log). Editing there saves via `PUT /api/alumni/update-with-related/[id]` (overlaps the full-form route; sets `adminEditedAt`). Replaces the deleted `/management/settings/alumni/[id]`. Orange indicators on this page query BOTH `resourceType: alumni` and `alumni_profile` (admin + alumni-self edits) — `OrangeCell`/`FieldHistoryModal`/`/api/field-changes` accept comma-joined `resourceType`.
- **Account lifecycle:** `POST /api/alumni-accounts/[id]/suspend` toggles suspension AND kills active `Session`s; `PUT /api/users/[id]` does the same for admin users.
- **CMU lookup:** `/api/cmu-alumni` (list/search) + `lib/cmu-registrar.ts` (`fetchCmuGraduateById`) feed import major-sync (`lib/ensure-alumni.ts`), signup verification (`/api/alumni-auth/signup`), and the add-education auto-fill preview (`/api/cmu-alumni/lookup`, which reuses `cmuToAlumniFields` and, given `?alumniId=`, returns `samePersonWarning` so the form can warn before the POST guard rejects).
- **Education / primary snapshot:** `PUT /api/educations/[id]` on the alumni's **primary** education re-syncs the denormalized `Alumni` snapshot via `syncPrimarySnapshot` (`lib/education-sync.ts`, runs inside the route's `$transaction`). That snapshot's `studentId` is the FK target for the 6 related tables (Award/Association/…) + what the all-alumni table reads — so an edit there cascades exactly like editing `Alumni.studentId` directly. Shared UI: `components/EducationSection.tsx` (switcher + add/edit dialogs), wired into both `/management/alumni/[id]` and `/graduates/(authed)/profile`.
- **Twin auth:** `/api/auth/*` (ADMIN) vs `/api/alumni-auth/*` (ALUMNI) share the `Session` model, split by `sessionType`.

**Redirects:**
- `/` → `/management/dashboard`; `/management` → `/management/dashboard`.
- `app/(admin)/layout.tsx` → `/login` when no admin session. `app/graduates/(authed)/layout.tsx` → `/login` (no alumni session) or `/graduates/tos` (TOS not yet accepted). `settings/profile` & `graduates/tos` pages also redirect to `/login` when unauthenticated.
- Both logout routes (`/api/auth/logout`, `/api/alumni-auth/logout`) → `/login`.
- OAuth: `/api/auth/callback/` → dashboard on success, `/login?error=…` on failure; flow starts at `/api/auth/cmu-login`.

**Entry points — legitimately have no in-app links (do NOT flag as unused):**
- Public/landing: `/`, `/login`, `/news/[id]`, `/graduates/{signup,forgot-password,reset-password,tos}`.
- OAuth/callback: `/api/auth/callback/`, `/api/auth/cmu-login`.
- Cron: `/api/auth/cleanup` (secured by `CLEANUP_SECRET` env var).

### Key Libraries

| Library | Purpose |
|---|---|
| `@tanstack/react-query` | Server-state / data fetching for client pages (most pages migrated to it) |
| `zod` | Schema validation (`lib/validations/`), also `react-hook-form` resolvers |
| `react-hook-form` + `@hookform/resolvers` | Form state + validation |
| `radix-ui` + shadcn/ui (`components/ui/*`, `components.json`) | Headless UI primitives / component library |
| `sonner` | Toast notifications |
| `lucide-react` | Icons |
| `next-themes` | Light/dark theme handling |
| `chart.js` + `react-chartjs-2` | Chart rendering (doughnut, bar) |
| `recharts` | Data visualization (line graphs) |
| `exceljs` | Excel import/export parsing (note: `xlsx` is NOT a dependency) |
| `sanitize-html` | HTML sanitization for news body |
| `bcryptjs` | Password hashing |
| `nodemailer` | Email (password reset) |

### Deployment

- **Docker:** Multi-stage Dockerfile (node:20-alpine), `output: "standalone"` in next.config.ts.
- **docker-compose.yml:** PostgreSQL 17 + app service.
- **CSP headers** configured in `next.config.ts` (YouTube/Vimeo frame-src, strict defaults).
- **Security headers:** X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy.

### Shared Components & Utilities

| File | Purpose |
|---|---|
| `components/Header.tsx` · `Sidebar.tsx` · `Footer.tsx` | Admin chrome (header w/ mobile hamburger, collapsible sidebar, footer) |
| `components/AlumniHeader.tsx` · `AlumniSidebar.tsx` | Alumni-portal chrome |
| `components/data-table.tsx` | Reusable sortable/paginated table |
| `components/OrangeCell.tsx` · `FieldHistoryModal.tsx` | Orange update indicators + per-field change-history modal |
| `components/ui/*` | shadcn/ui primitives (button, dialog, table, select, pagination, …) |
| `components/providers/query-provider.tsx` | TanStack Query client provider |
| `lib/constants.ts` | Thai labels, nav items, page size |
| `lib/role-context.tsx` | `useRole()` / `useCanWrite()` / `useIsAdmin()` |
| `lib/permissions.ts` | `checkWritePermission()` (401/403 guard) |
| `lib/activity-log.ts` · `lib/field-changes.ts` | Audit logging + per-field change tracking |
| `lib/ensure-alumni.ts` | Auto-create Alumni on import if studentId not found |
| `lib/cmu-registrar.ts` | CMU Registrar API integration (syncs major on import) |
| `lib/trash.ts` | Soft-delete trash management (restore / hard-delete) |
| `lib/alumni-agency-parse.ts` · `lib/award-import-parse.ts` | Excel parsers (former renamed from `abroad-alumni-parse.ts`) |
| `lib/excel-export.ts` · `lib/excel-import.ts` | Shared ExcelJS import/export helpers |
| `lib/validations/*.ts` | Zod schemas per entity (alumni, award, news, user, auth, …) |
| `lib/query-keys.ts` | TanStack Query key definitions |
| `lib/useBulkSelection.ts` · `lib/use-entity-list.ts` · `lib/useAlumniSearch.ts` | Client hooks (bulk select, entity list, search) |

## Key Constraints

- **Thai language** primary — all UI labels, column headers, validation messages, and enum values use Thai.
- **Degree levels (5):** ปริญญาเอก, ปริญญาโท, ปริญญาตรี, อนุปริญญา (ASSOCIATE), หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล
- **Award types:** รางวัลระดับนานาชาติ, รางวัลระดับชาติ, รางวัลระดับท้องถิ่น
- **Years** use Buddhist calendar (e.g., 2569, not 2026).
- **Thai fonts:** Sarabun, Noto Sans Thai loaded in globals.css.
- **App is deployed under `basePath: "/alumni"`** (`next.config.ts`) — route files define paths relative to it; mind basePath in links/fetches (some helpers auto-prepend, some don't).
- **Monolithic page components** — pages in `app/(admin)/management/` are large client components (700–1100+ lines, now built on TanStack Query). When modifying, be aware of the full scope.

## Working Protocol

> Read at the start of every task. These are the rules for how I communicate results and keep this instruction file honest. Follow them unless the user says otherwise.

### Git workflow — branch off, do the work, commit, then merge to `main`

Default flow for **every** task that changes code (the user wants it; it supersedes the generic "commit only when asked" rule):

1. **Branch off `main` first** — before writing any code, create a descriptively-named branch from `main` and switch to it. Never work or commit directly on `main`.
2. **Do the task** on that branch.
3. **Commit when finished** — once the work is done and verification (build/lint/tests) is green, commit it.
4. **Confirm in case of errors** — if anything fails (build, lint, tests, a merge conflict, or any unexpected problem), STOP and ask the user before committing/merging instead of forcing it through. Proceed only once it's green, or the user OKs it.
5. **Merge to `main`** — after committing, check out `main` and merge the branch back with `--no-ff` (keeps the feature unit visible in history). Leave the working tree clean and end on `main`.

Don't `git push` unless explicitly asked. If a request only needs exploration/answers (no code change), skip the flow.

### On finishing any task — produce a completion report

Before claiming a task is done, give a short structured report (tight bullets — never a file dump). Cover all of:

- **Plan executed** — the goal and the approach (1–3 lines). If the approach changed mid-task, say why.
- **Files changed** — `created` / `updated` / `deleted`, each with its real path (e.g. `app/(admin)/management/awards/page.tsx`). Don't lump them; distinguish creates from edits from deletes.
- **Libraries / tech used** — anything used or newly introduced (e.g. `@tanstack/react-query`, `zod`, `exceljs`). If a new dependency was added, name it + version + why.
- **Branch** — the current git branch (e.g. `main`, `feature/x`). State whether changes are committed or still uncommitted, and the commit hash if committed. Follow the **Git workflow** above — branch off `main` first, commit when done, merge back to `main`; pause for the user's confirmation if anything fails. Don't push unless asked.
- **Verification** — what confirms it works: tests run (+ pass/fail), `npm run lint` / `npm run build` status, manual steps. If something was NOT verified, say so explicitly rather than implying it was. To verify **live behavior**, hit the already-running dev server on `:3000` with `curl` (see Known Pitfalls: *Never spawn a second `next dev`*) — **never** start a second dev server for verification.

### On fixing a bug or problem — produce a root-cause report

After a fix, report:

- **Symptom** — what was wrong and how it showed up.
- **Root cause** — the actual underlying cause, not the surface behavior. Dig past "X didn't work" to *why*.
- **Fix** — what changed and why that addresses the root cause (not just a patch over the symptom).
- **Prevention** — concrete suggestions to stop it recurring (guard, test, lint rule, convention).
- **Self-improvement** — run the loop below so the same trap gets written into this file.

Be honest about certainty: if the root cause isn't fully confirmed, say "likely cause" + what would prove it — never dress a guess up as fact.

### On touching routes — keep the route map current

Routes here interconnect — admin pages link to each other, client components `fetch()` APIs, soft-delete pairs with `/api/trash/restore`, `create-with-related` / `update-with-related` overlap the single-entity CRUD routes, and auth guards redirect between areas. Whenever you **create, change, rename, or delete any route** (page, API route, or callback), keep the route documentation honest in the same task — update the **Route Structure** and **API Route Pattern** sections above. For the route(s) you touched, record:

- **Identify each route** — its path, (for APIs) method(s), what it does, and who calls it.
- **Correlations** — other routes that link to / fetch / depend on it, and any it overlaps or shares data with. Flag one-way vs round-trip pairs (e.g. `DELETE /api/alumni/[id]` soft-deletes → recoverable via `POST /api/trash/restore`; `DELETE /api/news/[id]` → `DISCONTINUED`, unrecoverable).
- **Redirection** — any redirect it issues or is subject to (layout guards, `proxy.ts`, OAuth callback `/api/auth/callback/`, role-based fallbacks). Mind `basePath: "/alumni"` on all paths.
- **Delete unused routes** — if a route has no link, fetch, redirect, or test referencing it, delete it instead of leaving dead code. First grep for the path in all its forms (literal, `/[id]` param form, and any `BASE_PATH`-prepended variant) to confirm nothing references it.

If a route's purpose can't be stated in one line, that's a signal it's doing too much or isn't needed — say so.

## Self-Improvement Loop — keep this file from repeating mistakes

When a bug fix reveals a *recurring trap or a project-specific gotcha* (not a one-off typo), update `CLAUDE.md` so future-me avoids it:

1. **Already covered?** If it's a general framework gotcha already in `AGENTS.md` (Prisma 7, Tailwind 4, Next.js 16, React 19), don't duplicate — at most tighten the existing line.
2. **Project-specific?** Append a concise entry to **Known Pitfalls & Lessons Learned** below using the template. If it fits, also add a one-line guard rule to the relevant section (Key Constraints, Auth & Roles, API Route Pattern, etc.).
3. **Keep it DRY and current.** Merge near-duplicates. If a later change makes a lesson obsolete (renamed route, dropped library, fixed root cause), update or delete the entry — stale instructions are worse than none.
4. **Don't bloat.** Prefer editing an existing rule over stacking a new one. Only lessons that would change how code is written belong here; ordinary non-recurring bugs don't.

Template for a ledger entry:

```
### <short, searchable title>
- **Symptom:** <what went wrong>
- **Root cause:** <why>
- **Prevention:** <the rule/guard to apply next time>
```

## Known Pitfalls & Lessons Learned

*(Append-only ledger of project-specific traps. See "Self-Improvement Loop" for when to add an entry.)*

### App is deployed under `basePath: "/alumni"`
- **Symptom:** Links, redirects, or fetches resolve to the wrong path in the deployed app.
- **Root cause:** `next.config.ts` sets `basePath: "/alumni"`. Route files define paths relative to it; some API helpers auto-prepend `BASE_PATH`, others need it manually.
- **Prevention:** Account for `basePath` in new links/calls. Don't hardcode absolute `/api/...` blindly — check whether the helper already prepends.

### Shared `lib/` files must stay client-safe (split Prisma into a `-server` module)
- **Symptom:** Build error `Can't resolve 'dns'` (or another Node-only module) traced to a client component.
- **Root cause:** A client component imported a `lib/` module that transitively pulls in Prisma / the `pg` driver.
- **Prevention:** Keep shared `lib/` modules client-safe. Put Prisma-backed logic in a dedicated `*-server.ts` file (pattern in use: `lib/filter-facets.ts` + `lib/filter-facets-server.ts`). Never import `@/lib/prisma` across a `"use client"` boundary.

### API routes swallow Prisma errors into generic 500s
- **Symptom:** A data API returns a blank 500 with no useful detail.
- **Root cause:** Route handlers catch Prisma errors and return a generic message, hiding the real cause.
- **Prevention:** When debugging an API failure, probe the Prisma layer directly (run a script with `node --env-file=.env --import tsx`) rather than trusting the API response. The runtime DB is remote Prisma Postgres.

### Schema edits require a created + applied migration on remote Prisma Postgres
- **Symptom:** A model/schema change doesn't take effect, or the generated client disagrees with the live DB.
- **Root cause:** `npx prisma generate` alone is not enough — the migration must be created AND applied to the remote DB, then the client regenerated.
- **Prevention:** After any `prisma/schema.prisma` change: create the migration, apply it to the remote DB, then `npx prisma generate`. Run DB scripts with `node --env-file=.env --import tsx`.

### model-representatives เครือข่าย comes from alumniNetwork.aspx, not CMU degree level
- **Symptom:** model-representatives `เครือข่าย` (stored in `ModelRepresentative.cohort`) showed fabricated values (all `ปริญญาโท`).
- **Root cause:** `imports/finalized/model-representatives.xlsx` held 15 fabricated test rows from `scripts/build-test-imports.ts` → `cohortLabel()`, which derives the network from CMU degree `level_id`. The real per-network reps live in `imports/scrapped/alumni-network.json` (scraped from `alumniNetwork.aspx`, section titles already stripped of `รายชื่อเครือข่ายศิษย์เก่า` + `(รุ่น …)`). `imports/` Excel files are test/fabricated artifacts — not the source of truth.
- **Prevention:** `เครือข่าย` is one of 5 networks only (ปริญญาพยาบาล / ผู้ช่วยพยาบาล / อนุปริญญาพยาบาล / ปริญญาโท / ปริญญาเอก) — never derived from degree level. Rebuild from the real source via `node --env-file=.env --import tsx scripts/rebuild-model-representatives.ts` (name-joins reps → studentId via `alumni-data.json`; reports unmatched to `alumni-network-unmatched.json`). `DRY_RUN=1` previews counts without touching the DB.

### model-representatives `cohort`=เครือข่าย, `generation`=รุ่นที่ (inverted vs. sibling entities)
- **Symptom:** FacetFilters showed wrong data — เครือข่าย filter listed names, รุ่นที่ filter listed เครือข่าย values.
- **Root cause:** PRD names the fields `network` (เครือข่าย) + `cohort` (รุ่นที่), but the `ModelRepresentative` schema stores เครือข่าย in **`cohort`** and รุ่นที่ in **`generation`** — the opposite of sibling entities (graduate-committee etc.), where `cohort` = รุ่นที่. Filters/columns copied from siblings land on the wrong field.
- **Prevention:** On model-representatives, map **เครือข่าย→`cohort`**, **รุ่นที่→`generation`**, **สาขาวิชา→`major`**. Don't assume `cohort` means รุ่นที่ here. Facet fields must also be in `FACET_FIELDS["model-representatives"]` (`lib/filter-facets.ts`); `generation` is numeric (already in `YEAR_FIELDS`).

### awards `awardType` is derived by granting body; `recipientName` was split into prefix/firstName/lastName
- **Symptom:** Award rows need a type (LOCAL/NATIONAL/INTERNATIONAL) but the scrape (`imports/scrapped/alumni-awards.json`) carries none; the model previously had one `recipientName` instead of the PRD's prefix/firstName/lastName.
- **Root cause:** The schema field was `recipientName`; PRD (`PRD.md` Award) wants `prefix`/`firstName`/`lastName` + `link`/`imageUrl` on the Award itself. The source has only รางวัล/รายชื่อ/รุ่น/ปี — no type, link, image, or description.
- **Prevention:** `recipientName` is gone — store `prefix` (nullable) + `firstName`/`lastName` (required) on the Award; the page form (`awardPageFormSchema`) enforces required names while the shared `awardFormSchema` (used by the alumni full-form) leaves them optional (routes auto-fill from the parent alumni). Classify type by granting body in `scripts/rebuild-awards.ts`: **single-institution** (มหาวิทยาลัย/คณะ/วิทยาลัย/สมาคมศิษย์เก่า) **or regional/provincial/school/Rotary → LOCAL**; **foreign/international body → INTERNATIONAL**; **Thai national body (กระทรวง, สมาคมพยาบาลแห่งประเทศไทย, สภาการพยาบาล, ปอมท./ทคพย./ปขมท., ศรีสังวาลย์, วันมหิดล, แห่งชาติ) → NATIONAL** (default). A regional **chapter** of a national body (`…แห่งประเทศไทย ภาคเหนือ`) is LOCAL — directional regional keywords (`ภาคเหนือ/ใต้/กลาง/อีสาน`) are checked *before* national; but a national award won in a regional **category** (`ส่วนภูมิภาค`/`ภาครัฐ`) stays NATIONAL. Do NOT reuse `seed.ts:classifyAwardTier` (it misclassifies EACC→INTL and defaults unmatched→LOCAL). Rebuild real data: `node --env-file=.env --import tsx scripts/rebuild-awards.ts` (`DRY_RUN=1` previews the type distribution + unmatched). `link`/`imageUrl`/`description` are null — the scrape has no source for them.

### All person-name entities use `prefix` + `firstName` + `lastName` (combined-name split)
- **Symptom:** A combined `fullName`/`name`/`thaiName` column needs splitting into the PRD's `prefix` + `firstName` + `lastName`.
- **What's split:** `Award` (was `recipientName`), `Potential`/`Association`/`GraduateCommittee` (were `fullName`), `ModelRepresentative` (was `name`), `AlumniAgency` (was `thaiName`; keeps `englishName` + its own `prefix`). Shape is `prefix String?` + `firstName String` + `lastName String` (required-name entities); AlumniAgency's firstName/lastName are **nullable** (the Thai name was optional). Reuse `splitFullName()` in `lib/parse-name.ts` (title-strip + whitespace split) — shared by the Excel import legacy-column fallback, `seed.ts`, `scripts/rebuild-*.ts`, and the backfill. The shared `{entity}FormSchema` carries optional names (full-form auto-fills from parent); `{entity}PageFormSchema` extends to required for the management page; `create-with-related` / `update-with-related` / **`alumni-profile`** routes all auto-fill `prefix/firstName/lastName` from the parent alumni — the full-form payload carries NO name for these sections (like Award).
- **Migration mechanics (splitting a NOT NULL column):** needs TWO migrations — (1) add the new cols **nullable** + `ALTER … DROP NOT NULL` on the legacy col, (2) after backfilling, `SET NOT NULL` on the new cols + `DROP COLUMN` the legacy. Author/apply non-interactively: `prisma migrate dev --name X --create-only` (sometimes refuses "non-interactive"), else `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o prisma/migrations/<ts>_name/migration.sql` then `npx prisma migrate deploy`. The one-off backfill is a script run via `node --env-file=.env --import tsx` with `DRY_RUN=1`, then **deleted** (it reads dropped columns and won't compile against the final schema).
- **Drift gotcha — ALWAYS run `npx prisma migrate status` before migrating.** An abandoned worktree may have applied a migration to the remote DB that is **missing from your local `prisma/migrations/`** → Prisma reports drift and offers `migrate reset` (data loss). Copy the missing migration file into your folder to reconcile; **never accept a reset** on the shared remote DB.

### Never spawn a second `next dev` to verify — reuse the already-running server on :3000
- **Symptom:** At end-of-task verification the session froze / hung for the full tool timeout.
- **Root cause:** I ran `npm run dev` (or `next dev`) while the user's dev server already holds port 3000. Next 16 detects the collision via `.next/dev/` and **refuses to bind** — it first tries another port (`⚠ Port 3000 is in use … using available port 3001 instead`), then prints `⨯ Another next dev server is already running … Run kill <pid>`. Depending on stdin it either exits(1) or stalls on its spinner (`[?25h`) — that stall is the freeze. It never produces a usable server to verify against, so the spawn was pointless either way.
- **Prevention:** A dev server is normally already running on `http://localhost:3000` (this project uses `basePath: "/alumni"`, so routes are at `/alumni/...` and APIs at `/alumni/api/...`). **First** probe it: `curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/alumni/login` → any HTTP status (e.g. 200/307) means reuse it. Verify changes by curling that server; do NOT run `npm run dev` / `next dev` a second time. Only if **nothing** is listening, start one with the Bash tool's `run_in_background: true` and poll the log for `Ready` — **never foreground**, because a dev server runs forever and blocks the tool call indefinitely.

### all-alumni: two tables, two sort mechanisms (CMU birthday normalized client-side)
- **What:** The all-alumni page (`app/(admin)/management/all-alumni/page.tsx`) has two tables. **Both** fetch the FULL CMU list once (query keyed **without `page`** — only `search`/`filters`/`sort`; `pageSize=50000` since `/api/cmu-alumni` caps at `MAX_PAGE_SIZE=50000`), merge + sort the complete set, then slice client-side (`allMerged.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)`) — so navigating pages is instant (no refetch). They differ only in WHERE the sort happens. **View** (default, `manageMode=false`) sorts **server-side** via the CMU proxy `sortFieldMap` (every view field — `studentId`/`name`/`surname`/`degreeLevel`/`major`/`year`/`cohort`/`birthDate` — is CMU-sortable, so the proxy returns the full list already ordered and the client just overlays local data + slices). **Manage** (`manageMode=true`) sorts **client-side** with `sortAlumni(merged, sortField, sortDir)` (`lib/alumni-sort.ts`) — because it merges CMU + local rows in the browser and the CMU proxy can't sort local-only fields (`prefix`, `firstName`, …). `allMerged`/`allViewMerged` (the full set, not the page slice) is used for delete/bulk-delete lookups so CMU-only rows selected on other pages still resolve. (View mode previously keyed **with** `page` and refetched both `/api/cmu-alumni` and the full `/api/alumni` DB scan on every page change — changed to the full-set-once + client slice to kill per-page latency.)
- **Birthday:** CMU `birthday` is raw **DD-MM-YYYY** (Thai day-first — NOT US MM-DD; it won't sort lexicographically). Normalize it to canonical `YYYY-MM-DD` via `normalizeCmuBirthday` (`lib/alumni-verify.ts`) — used in **both** merges (so CMU-only rows carry a `birthDate`; the view merge prefers the authoritative CMU value over a possibly-stale stored `local.birthDate`), and in the CMU proxy's `birthDate → birthday` sort special-case. YYYY-MM-DD then sorts chronologically as a string. The view-table cell displays it via `formatBirthDateThai` → Thai **DD-MM-YYYY Buddhist** (year + 543). Note: `normalizeCmuBirthday` was originally (wrongly) coded as MM-DD-YYYY; the form-side parser `normalizeFormBirthDate` was already day-first, so the MM-DD assumption made signup `birthDatesMatch` inconsistent — DD-MM is correct.
- **Trap:** Adding a sortable column to the **manage** table needs no proxy change — `sortAlumni` sorts any field generically on the merged array. Adding one to the **view** table needs a `sortFieldMap` entry in `/api/cmu-alumni`, plus a chronological special-case for any raw date field. Don't page the CMU proxy in **either** mode (one page at a time) and merge per-page — local-only rows would repeat across pages and the sort would be wrong. Fetch the **full** set once, merge, sort, then slice client-side (see above).

### CMU returns one record per degree → dedup-by-person is DISPLAY-LAYER ONLY
- **Symptom:** The same person shows up as multiple rows (and inflates counts) because they earned more than one FON degree — e.g. a Bachelor's then a Doctoral. Each degree is a separate CMU record with a **distinct `student_id`** and different `level_id`.
- **Root cause:** `fetchCmuGraduates()` (`lib/cmu-registrar.ts`) returns the raw per-degree list; nothing in the upstream collapses them. Display/count surfaces were reading it verbatim, so one person counted N times.
- **Prevention:** Use `dedupeCmuGraduatesByPerson(graduates)` (`lib/alumni-verify.ts`) — matches on `name_th`+`surname_th`+canonical birthday (NUL-joined), keeps the **highest** degree (`DOCTORAL>MASTER>BACHELOR>ASSOCIATE>NURSING_ASSISTANT`), and leaves incomplete-identity records verbatim. **Apply it ONLY in the table + facet display surfaces**: `/api/cmu-alumni` (on the full list, *before* search/facets/sort/pagination so records on different pages still collapse) and `lib/filter-facets-server.ts` (`getAlumniFacetValues`, so facet counts match the table). The dashboard **count** routes (`/api/alumni-count`, `/api/dashboard`) instead use the merged person count below — NOT this dedup. **NEVER** apply it in studentId-keyed consumers — `lib/ensure-alumni.ts` (the import studentId→record map) and `app/api/alumni/[id]/route.ts` (profile lookup by studentId) MUST keep the raw `fetchCmuGraduates()`, because dedup drops each person's lower-degree `student_id`s and would silently break CMU enrichment on import / profile view. `fetchCmuGraduates()` itself stays un-deduped (its 5-min cache serves both the deduped and the raw consumers).

### Dashboard "alumni by degree" counts merge CMU + local (a person never counts twice)
- **Symptom:** The dashboard must count each PERSON once under their highest degree — across CMU AND local `education` rows (a locally-added higher degree upgrades the person; nobody is double-counted when in both sources).
- **Root cause:** CMU (the FON graduate universe) and the local `education` table overlap (signed-up/imported alumni are a subset of CMU). Counting each source separately double-counts the overlap and ignores locally-added degrees.
- **Prevention:** Use `getPersonDegreeBreakdown()` (`lib/person-degree-count.ts`) in `/api/alumni-count` and `/api/dashboard`. Its pure core `groupPersonsByDegree(cmu, local)` unions entities via three signals — CMU records sharing normalized name+birthday, a local alumni's `education` rows (one `alumniId`), and a cross-source **studentId bridge** (a local education whose `studentId` matches a CMU record joins that CMU person). Each group → one person, highest degree (`DEGREE_RANK` from `lib/alumni-verify.ts`), representative year = that degree's most recent year. The table (`/api/cmu-alumni`) + facets still use `dedupeCmuGraduatesByPerson` (CMU-only) — full table/facet consistency with the merged count is a follow-up. **Note:** alumni-count's `DEGREE_ORDER`/labels are now only used for response shaping, not degree resolution.

### Signup verifies a `degreeLevel` selector and creates the `Education` row
- `/api/alumni-auth/signup` now requires a `degreeLevel` select (client `alumniSignupSchema` + API `alumniSignupApiSchema`). After identity verification, the submitted degree is **verified** against the authoritative degree for the studentId (CMU's level if consulted, else the matching local `Education` row, else the alumni snapshot) — mismatch → 400. On success an `Education` row is created (idempotent on studentId) and set as primary if the alumni has none, then `syncPrimarySnapshot`. Signup still auto-logins → `/graduates/profile` (TOS gate kept). The alumni-portal + admin profile render educations as a responsive grid of colored cards (`components/EducationSection.tsx`, 1/row on narrow screens, 2/row wider) tinted with `DEGREE_COLORS` (`lib/constants.ts`, the same colors as the dashboard graph); each card has its own แก้ไข button.

### CMU GET requests can't carry a body — `fetchCmuGraduateById` uses the cached list
- **Symptom:** Signup returned `503` "ไม่สามารถติดต่อระบบทะเบียนเพื่อยืนยันข้อมูลได้" whenever an applicant wasn't matched locally (so the CMU fallback ran).
- **Root cause:** `fetchFromCmuApi` always attached an auth body (`cmuaccount_name`/`api_id`) — fine for the POST list call, but `fetchCmuGraduateById` used `method: "GET"`, and Node's `fetch` (undici) throws `TypeError: Request with GET/HEAD method cannot have body`. That throw was caught in `/api/alumni-auth/signup` and surfaced as the 503. The CMU **list** (POST) worked, so the bug only appeared on the by-id path.
- **Prevention:** `fetchCmuGraduateById` (`lib/cmu-registrar.ts`) now resolves from the cached `fetchCmuGraduates()` list (FON-filtered, 5-min cache, shared with the dashboard/all-alumni/import flows) instead of a per-id GET — reliable and fast. `fetchFromCmuApi` was also fixed to pass auth as a query string (not a body) for GET. If you add another CMU endpoint, never send a body with GET/HEAD. (This also fixed the add-education CMU auto-fill preview `/api/cmu-alumni/lookup`, which uses the same function.)

### `Education` models multiple degrees; `Alumni` degree fields are a denormalized PRIMARY snapshot
- **Symptom:** Need one person to carry several FON degrees (distinct `studentId`/`degreeLevel`/`graduationYear`), viewable/editable per degree — but `studentId` is `@unique` on `Alumni` and the FK target for 6 related tables, so it can't simply become multi-valued.
- **Root cause:** `Alumni` was 1-degree-per-row. The fix is a 1:N `Education` model, BUT `Alumni.studentId` must stay unique+populated (it's the join key for Award/Association/GraduateCommittee/Potential/ModelRepresentative/AlumniAgency and the signup/import identity anchor).
- **Prevention:** `Education` (`@@unique([alumniId, degreeLevel])`, `studentId @unique`) holds every degree. `Alumni` KEEPS a denormalized **primary** snapshot (`studentId`/`degreeLevel`/`graduationYear`/`major`/`cohort`) + `primaryEducationId` pointing at the primary `Education` row. **Never edit the snapshot directly** — edit the primary `Education` row and let `syncPrimarySnapshot(alumniId, tx?)` (`lib/education-sync.ts`) mirror the 5 fields back (called inside `PUT /api/educations/[id]`'s `$transaction` so the edit + sync are atomic; the snapshot's `studentId` change cascades to related rows via the existing `ON UPDATE CASCADE` FK). Backfilled via `scripts/backfill-educations.ts` (one Education per alumni from its snapshot + `primaryEducationId`). New educations are non-primary by default (no "set as primary" in v1); deleting the primary is blocked. UI lives in `components/EducationSection.tsx`. The `dedupeCmuGraduatesByPerson` display dedup is unaffected — it's CMU-side; `Education` is local storage; the two coexist. `Education.firstName`/`lastName` carry the **name at study time** — backfilled from CMU (`name_th`/`surname_th`), not the alumni's current name (a person who changed surname keeps the study-time name on each degree card). `syncPrimarySnapshot` mirrors only the 5 degree fields, NOT the names.

### Profile view = 3 ordered sections (ข้อมูลส่วนตัว / ประวัติการศึกษา / ข้อมูลติดต่อ) + 6 related
- **What:** Both `/management/alumni/[id]` (admin) and `/graduates/(authed)/profile` (alumni-self) render the same view order: **ข้อมูลส่วนตัว** (คำนำหน้า/ชื่อ/นามสกุล/วันเกิด วว/ดด/ปปปป พ.ศ. via `formatBirthDateThaiSlash`) → **ประวัติการศึกษา** (`EducationSection` cards) → **ข้อมูลติดต่อ** (อีเมล/เบอร์โทรศัพท์/ที่อยู่ปัจจุบัน= `homeAddress`) → the 6 related sections. The old 8-field "ข้อมูลพื้นฐาน" grid and "ข้อมูลการทำงาน" section are gone.
- **Why:** `currentWorkplace`/`country`/`province` were dropped from `Alumni`; `maidenLastName`+`newLastName` merged into `lastName`. Admin uses `HotInfoField`/`OrangeCell` (orange edit indicators) on the personal + contact fields; alumni-self uses plain `InfoField`. `homeAddress` (existed on the schema, previously only used by `AlumniAgency`) is now the alumni contact address — wired into `profileFormSchema`/create-update-with-related/`alumni-profile`/forms.

### Running dev server caches the OLD Prisma client after a migration (restart required)
- **Symptom:** After `prisma migrate deploy` + `prisma generate`, the already-running dev server returns HTTP 500 with `PrismaClientKnownRequestError: The column alumni.<droppedCol> does not exist in the current database` — even from a plain `include: { alumni: true }` that names no columns.
- **Root cause:** `lib/prisma.ts` caches the client in `globalThis.__prisma` (survives HMR). The running process loaded the PRE-migration client into memory; `prisma generate` updates the files under `app/generated/prisma/` but the in-memory singleton still issues SQL for the old columns (e.g. the dropped `maidenLastName`), so every query touching the changed model 500s. The fresh client (used by `npm run build`, `npm run test`, and one-off `node --env-file=.env --import tsx` scripts) is correct.
- **Prevention:** After any `prisma migrate` + `generate` against a schema change, the dev server MUST be restarted (Ctrl+C the `npm run dev` process, re-run it) before live verification — don't trust a 500 from the stale server as a code bug. Verify the data layer independently with a `node --env-file=.env --import tsx` script (uses the fresh client) and confirm `npm run build` + `npm run test` pass.

### Alumni identity resolution, override flag & SYSTEM graduation logs
- **Model:** The personal-info name (`prefix`/`firstName`/`lastName`) is a *resolved* value. It defaults to the **highest** degree's study-time name (`DEGREE_RANK`: nursing_assistant<associate<bachelor<master<doctoral) and is re-synced by `syncNameFromHighestDegree(alumniId, tx?)` (`lib/name-sync.ts`) whenever the degree set changes — UNLESS `Alumni.nameManuallyUpdated` is true. `prefix` has no per-degree source (`Education` has no `prefix`), so the sync touches only `firstName`/`lastName`. `logActivity` now accepts a `tx` and a `SystemLogContext` (`{ actorType:"SYSTEM"; alumniId?; alumniName? }`); `ActorType` gained `SYSTEM`.
- **Override:** Every edit sets `nameManuallyUpdated=true` in the alumni PUT routes (`alumni/[id]`, `update-with-related/[id]`, `alumni-profile`) — once edited, the current name sticks and isn't re-synced by later higher-degree graduations. (The `แก้ไข`/`อัพเดท` reason selector that used to gate this was removed — there's no edit reason anymore; every edit overrides.)
- **No edit reason:** The required แก้ไข/อัพเดท selector was deleted. `editReasonField` (`lib/validations/helpers.ts`) now returns an **optional** string (kept so update schemas still expose `reason` for the activity log when present); forms capture/send none. `ActivityLog.reason`/`FieldChangeHistory.reason` columns remain (graduation logs use them for the remark).
- **Graduation logs:** `generateGraduationLogs(alumniId, tx?)` (`lib/graduation-log.ts`) writes one `SYSTEM` `ActivityLog` per degree (resource `education`), ordered by CMU `grad_date` (fallback `graduationYear`→row `createdAt`; `graduationYear` is **Buddhist** and is converted to CE — see the Buddhist-backdate pitfall below), first degree=`CREATE`/rest=`UPDATE`, reason `สำเร็จการศึกษา <degreeLabel>`, backdated to `grad_date`. **Idempotent** (keyed by `details.studentId`). Hooked on Education create (signup, `alumni/[id]/educations`, `alumni-profile/educations`) + `syncNameFromHighestDegree`. Backfilled via `scripts/backfill-graduation-logs.ts`.
- **Changes modal:** `FieldChangeHistory.activityLogId` (nullable FK) links a graduation/edit event to its field rows; `GET /api/alumni/[id]/activity` embeds them as `changes[]` on each activity item. `AlumniActivityTimeline` rows are clickable → inline `ActivityDetailModal`. `education` is in `TRACKED_FIELDS` (`lib/field-changes.ts`).
- **CMU new-row detection (virtual):** `POST /api/cmu-alumni/sync` (secured by `CMU_SYNC_SECRET` Bearer) diffs `fetchCmuGraduates()` vs local `studentId` and reports the un-logged count — it does NOT create local rows (per the virtual-CMU choice). Such persons earn graduation logs when they later sign up / are imported.

### Adding an education must pass the same-person (birthday) identity guard
- **Symptom:** A signed-up alumni "added a higher degree" by entering another person's CMU studentId; the all-alumni table still showed their old lower-degree row, and the dashboard graph mis-counted (the two different people were silently merged into one "person" under the higher degree — measured delta: Bachelor −1, total persons −1, Master unchanged — instead of the expected Master +1).
- **Root cause:** The add-/edit-education flows had no identity check, so a stranger's degree could be attached to an alumni. Per the PRD (§3.1.2) an alumni's educations are their OWN FON degrees, claimed by identity verification at sign-up. A stray degree (a) can never collapse in the all-alumni table — `dedupeCmuGraduatesByPerson` keys on name+birthday, so two different people stay as two rows (the lower-degree row persists), and (b) corrupts the dashboard — `groupPersonsByDegree` (`lib/person-degree-count.ts`) trusts that ALL of an alumni's education `studentId`s are ONE person, so the studentId bridge merges the stranger's CMU record into the alumni.
- **Prevention:** `assertEducationSamePerson` (`lib/education-identity.ts`, server-only) is called by `POST /api/alumni-profile/educations`, `POST /api/alumni/[id]/educations`, and `PUT /api/educations/[id]` (only when `studentId` changes). It compares the new studentId's CMU birthday to the alumni's birthday — the one constant identity signal (names can change between degrees, so name is NOT decisive) — and returns a 400 Thai error on mismatch. It fails OPEN (allows) when CMU is unreachable or either side lacks a birthday, so a registrar outage / sparse record doesn't block all edits. `GET /api/cmu-alumni/lookup?studentId=…&alumniId=…` returns `samePersonWarning` for the add-education preview. Audit/cleanup of pre-existing strays (idempotent): `node --env-file=.env --import tsx scripts/remove-stray-education.ts` (`DRY_RUN=1` to list; also deletes each stray's SYSTEM graduation log + field-change rows, then re-syncs the name). Legitimate same-person higher degrees still merge everywhere — the CMU dedup (table) and `groupPersonsByDegree` (dashboard) already collapse a person's own multi-degree records to their highest.

### `activity_logs.ipAddress` was dropped; `getIp` survives as rate-limiting infra
- **Symptom:** Tempting to delete `getIp` (`lib/activity-log.ts`) wholesale when removing activity-log IP capture.
- **Root cause:** `getIp` lives in a *logging* file but is used by `cmu-alumni/route.ts` for `checkRateLimit(\`cmu-alumni:${ip}\`)` — independent of logging. The auth routes (`login`, `signup`, `forgot/reset-password`, `login-email`) instead extract the IP from headers directly for their own rate-limiting.
- **Prevention:** The `ipAddress` DB column + the `logActivity` `ipAddress` param were removed (migration `20260625010517_drop_activity_log_ip_address`, 2026-06) — activity logs no longer capture IP. But `getIp` MUST stay (only `cmu-alumni` still imports it). When removing a positional `logActivity` arg, note `ipAddress` was param 6 (before `reason`/`tx`); a leftover arg silently binds to `reason` (both `string | null`) so tsc won't catch stragglers — grep-verify. Also, handlers that used `request` ONLY for `getIp(request)` (e.g. `accept-tos` POST, `users` GET, `alumni-profile` DELETE) lose their `request` param — drop it or prefix `_`.

### Uploaded/public images must be basePath-prefixed at render (`assetUrl`)
- **Symptom:** News form image preview (and news cards + public/alumni detail pages) showed a broken image with a 404 on the GET, even though the file existed in `public/uploads/` and `POST /api/upload` returned 201.
- **Root cause:** `basePath: "/alumni"` means `public/uploads/x.png` is served at `/alumni/uploads/x.png`, but the upload route (and the DB) intentionally store the path basePath-**relative** (`/uploads/x.png`). Render sites used raw `<img src={storedPath}>` without prepending `BASE_PATH`, so the browser requested `/uploads/x.png` → 404. The logo gets this right (`components/Header.tsx`: `src={`${BASE_PATH}/fon-cmu-logo.png`}`); the news pages didn't.
- **Prevention:** Never render a stored/uploaded or `public/` asset path directly in a raw `<img src>`/anchor. Wrap it with `assetUrl(path)` (`lib/asset-url.ts`, **client-safe** — imports only `BASE_PATH`, no Prisma) — it prepends `BASE_PATH` for relative paths and leaves `http(s)://`, protocol-relative `//`, `data:`, and already-prefixed paths untouched (so it's safe around any src). For rich-text HTML blobs (the news `body`), use `prefixUploadsInHtml(html)` at render (and when loading into the contentEditable editor so its images load live) and `stripUploadsInHtml(html)` before persisting — storage stays basePath-relative and the editor round trips cleanly. **Do NOT "fix" this by baking `/alumni` into stored URLs** (the upload route returns the relative path on purpose); existing relative data is already correct and needs no migration.

### Graduation logs backdate by Buddhist `graduationYear` — convert to CE or they land ~543 years in the future
- **Symptom:** The admin activity log (`/management/settings/logs`) was flooded with "unknown entity" `CREATE` rows for `resource=education` dated to the year ~2524 CE (far future), which floated them to the top of the list (sorted `createdAt DESC`). Each showed no actor ("—") and a raw, unlabeled `education` resource.
- **Root cause:** `generateGraduationLogs` (`lib/graduation-log.ts`) backdates each degree's log to its graduation date. When CMU `grad_date` is present it's CE and parses fine, but the fallback `yearToDate(graduationYear)` used the **Buddhist** `graduationYear` (e.g. 2525 = CE 1982) directly as a CE year → `new Date(2525,0,1)` = year 2525 CE. Separately, these logs are `actorType: SYSTEM` with `alumniName: null`, which the logs page rendered as "—" (no SYSTEM-actor handling) under an `education` resource that had no Thai label.
- **Prevention:** `yearToDate` now converts Buddhist→CE (`year > 2400 ? year − 543 : year`) — always convert Buddhist years to CE before constructing a backdate `Date`. The logs page now labels `education` → "ประวัติการศึกษา", renders `actorType: SYSTEM` as a "ระบบ" badge (not "—"), and the source filter gained a `system` option (`/api/logs` maps `source=system` → `actorType: SYSTEM`). The 32 pre-existing mis-dated logs were corrected by `scripts/fix-graduation-log-dates.ts` (idempotent: only touches education SYSTEM logs with `createdAt > 2100`, and re-applies the date to their linked `field_change_history` rows).

